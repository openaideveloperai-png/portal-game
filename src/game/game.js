// The game: boot, title, level flow, the lift-cage ride between chambers, pause,
// death/respawn, restart, HUD, and a small debug API used by the automated tests.
import * as THREE from 'three';
import { initPhysics } from '../core/physics.js';
import { audio } from '../core/audio.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { Tare } from './tare.js';
import { Story } from './story.js';
import { Characters } from './characters.js';
import { LEVELS } from '../levels/index.js';
import { saveSettings } from '../core/save.js';
import { wait, nextFrame, clamp } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Game {
  constructor(engine, input, settings, save, ui) {
    this.engine = engine; this.input = input; this.settings = settings; this.save = save; this.ui = ui;
    ui.game = this;
    this.state = 'loading';
    this.level = null; this.levelIndex = 0;
    this.player = new Player(this);
    this.story = new Story(this);
    this.characters = new Characters(this);
    this.tare = new Tare(this);
    this.stats = { draws: 0, gives: 0, deaths: 0, start: performance.now() };
    this.paused = false;
    this.inputLocked = false;
    this.restartHold = 0;
    this.debugNoLock = /[?&]nolock/.test(location.search);
    this.applySettings();
    engine.onFixed = dt => this.fixed(dt);
    engine.onFrame = (dt, a) => this.frame(dt, a);
    input.onLockChange = (locked, failed) => this.onLock(locked, failed);
    input.onEscape = () => this.onEscape();
    window.addEventListener('keydown', e => {
      if (this.ui.docOpen && (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.ui.docOpen.close(); }
      else if (e.code === 'Tab' && this.state === 'playing') { e.preventDefault(); this.openJournal(); }
    });
  }

  applySettings() {
    const s = this.settings;
    this.input.sensitivity = s.sensitivity; this.input.invertY = s.invertY;
    this.engine.setFov(s.fov);
    Object.assign(audio.volumes, { master: s.master, music: s.music, voice: s.voice, sfx: s.sfx ?? 0.9, amb: 0.8 });
    audio.applyVolumes();
    document.documentElement.style.setProperty('--sub-size', s.subSize + 'px');
  }

  // ------------------------------------------------------------------ boot / title
  async boot() {
    this.ui.showLoading();
    this.ui.setLoading(0.02, 'Calibrating the instruments…');
    await initPhysics();
    this.ui.setLoading(0.08, 'Fetching the reference persons…');
    try {
      await this.characters.load(p => this.ui.setLoading(0.08 + p * 0.7));
    } catch (e) {
      console.error(e);
      this.ui.loadingError('Some character files could not be loaded. The game will continue without people.');
    }
    try { if (this.characters.ready) this.tare.attachHand(this.characters.viewArm()); } catch (e) { console.warn('view arm', e); }
    this.ui.setLoading(0.85, 'Opening the ledgers…');
    await document.fonts?.ready;
    this.engine.start();
    await this.showTitle();
    this.ui.setLoading(1, 'Ready.');
    this.ui.hideLoading();
  }

  async showTitle() {
    this.state = 'title';
    this.input.unlock();
    this.tare.show(false); this.tare.enabled = false;
    this.ui.showHud(false);
    if (!this.level || this.levelIndex !== 0) await this.loadLevel(0, { title: true });
    this.titleT = 0;
    const s = this.save;
    const cont = s.hasProgress ? LEVELS[Math.min(s.data.level, LEVELS.length - 1)] : null;
    this.ui.showTitle({
      canContinue: !!cont,
      continueNote: cont ? `${cont.ledger === 'P' ? 'Prologue' : 'Ledger ' + cont.ledger}${cont.chamber ? ' · ' + cont.chamber : ''}` : null,
      onNew: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onChapters: () => this.ui.showChapters(LEVELS, s.data.furthest, i => { this.ui.closeForm(); this.startAt(i); }, () => this.ui.closeForm()),
      onSettings: () => this.openSettings(() => this.ui.closeForm()),
      onCredits: () => { this.ui.hideTitle(true); this.ui.showCredits(() => this.showTitle()); },
    });
  }

  newGame() { this.save.reset(); this.startAt(0); }
  continueGame() { this.startAt(this.save.data.level); }

  async startAt(i) {
    audio.init();
    this.ui.hideTitle();
    this.ui.closeForm();
    if (i === 0 && this.level && this.levelIndex === 0) {
      // the title scene is the prologue; begin from where it stands
      this.level.def.begin?.(this.level);
    } else {
      await this.ui.fade(1, 600);
      await this.loadLevel(i);
      this.ui.fade(0, 900);
    }
    this.state = 'playing';
    this.ui.showHud(true);
    this.requestLock();
  }

  requestLock() {
    if (this.debugNoLock) return;
    this.input.lock();
    setTimeout(() => { if (!this.input.locked && this.state === 'playing' && !this.ui.docOpen && !this.ui.formOpen) this.ui.showResume(() => this.requestLock()); }, 400);
  }

  onLock(locked, failed) {
    if (locked) { this.ui.hideResume(); if (this.paused) this.resume(); return; }
    if (this.state === 'playing' && !this.ui.docOpen) this.pause();
    else if (this.state === 'playing' && this.ui.docOpen) { /* document handles itself */ }
    if (failed && this.state === 'playing') this.ui.showResume(() => this.requestLock(), 'Click to capture the mouse');
  }

  onEscape() {
    if (this.ui.docOpen) { this.ui.docOpen.close(); return; }
    if (this.state === 'playing' && !this.paused) this.pause();
    else if (this.paused && this.ui.formOpen) { this.resume(); }
  }

  pause() {
    if (this.paused || this.state !== 'playing') return;
    this.paused = true;
    this.ui.showPause({
      level: this.level?.def,
      onResume: () => this.resume(),
      onRestart: () => { this.resume(); this.restartChamber(); },
      onSettings: () => this.openSettings(() => this.pauseMenuAgain()),
      onJournal: () => this.openJournal(() => this.pauseMenuAgain()),
      onQuit: () => { this.paused = false; this.ui.closeForm(); this.ui.fade(1, 500).then(async () => { await this.showTitle(); this.ui.fade(0, 800); }); },
    });
  }
  pauseMenuAgain() { this.paused = false; this.pause(); }
  resume() {
    this.ui.closeForm();
    this.paused = false;
    this.requestLock();
  }
  openSettings(back) {
    this.ui.showSettings(this.settings, key => { this.applySettings(); saveSettings(this.settings); void key; }, back);
  }
  openJournal(back = null) {
    const wasPlaying = !this.paused;
    if (wasPlaying) { this.paused = true; this.input.unlock(); }
    this.ui.showJournal(this.save.documents(), () => { if (back) back(); else { this.ui.closeForm(); this.resume(); } });
  }

  onDocumentOpened() { this.inputLocked = true; }
  onDocumentClosed() { this.inputLocked = false; if (this.state === 'playing' && !this.input.locked && !this.debugNoLock) this.requestLock(); }

  // ------------------------------------------------------------------ levels
  async loadLevel(index, { cageLocal = null, title = false } = {}) {
    this.story.cancelAll();
    if (this.tare.held) this.tare.drop();
    this.tare.held = null; this.tare.target = null;
    if (this.level) { this.level.dispose(); this.level = null; this.player.detach(); }
    const def = LEVELS[index];
    this.levelIndex = index;
    const L = new Level(this, def);
    this.level = L;
    L.build();
    // the instrument as of this chamber
    const t = def.tare || {};
    this.tare.enabled = !!t.enabled || (t.enabled === undefined && def.ledger !== 'P');
    this.tare.debtUnlocked = !!t.debt;
    if (this.tare.capacity !== (t.capacity || 1)) this.tare.setCapacity(t.capacity || 1);
    this.tare.stored = 0;
    this.tare.show(this.tare.enabled && !title);
    let spawn = { pos: L.spawn.pos, yaw: L.spawn.yaw, weight: def.playerWeight ?? 2 };
    if (cageLocal && L.entryCage) {
      const w = L.entryCage.toWorld(cageLocal.pos);
      spawn = { pos: [w.x, w.y, w.z], yaw: cageLocal.yaw + L.entryCage.rotY, weight: spawn.weight };
    }
    this.player.attach(L.phys, spawn);
    L.start();
    if (!cageLocal && L.entryCage) setTimeout(() => { if (this.level === L) L.entryCage.openGate(); }, 900);
    if (!title) {
      this.save.setLevel(index);
      if (def.ledger !== 'P') setTimeout(() => this.ui.card(`Ledger ${def.ledger}${def.chamber ? ' · Chamber ' + def.chamber : ''}`, def.title), cageLocal ? 2600 : 600);
    }
    // let the GPU compile programs before the first visible frame
    try { this.engine.renderer.compile(this.engine.scene, this.engine.camera); } catch (e) { /* not fatal */ }
    return L;
  }

  async beginTransition(cage) {
    if (this.state !== 'playing') return;
    this.state = 'transition';
    const p = this.player;
    if (this.tare.held) { const o = this.tare.held; this.tare.drop(); this.level.lostObject(o); }
    if (this.tare.stored > 0) { this.ui.flash(`Carried measures declared: ${this.tare.stored}. Returned to Institute stock.`, 2800); this.tare.stored = 0; audio.play('stamp'); }
    const local = { pos: cage.toLocal(p.feet(V())), yaw: p.yaw - cage.rotY };
    p.frozen = true;
    cage.closeGate();
    await wait(1100);
    cage.ride?.(true);
    const motor = audio.loop('motor', { gain: 0.25 });
    const chain = audio.loop('chain', { gain: 0.2 });
    this.shake = 0.6;
    await wait(500);
    const next = Math.min(this.levelIndex + 1, LEVELS.length - 1);
    await this.loadLevel(next, { cageLocal: local });
    const nc = this.level.entryCage;
    nc?.ride?.(true);
    nc?.closeGate();
    this.player.frozen = true;
    await wait(2300);
    motor?.stop(0.6); chain?.stop(0.6);
    audio.play('clank', { gain: 0.9 });
    this.shake = 1.2;
    nc?.ride?.(false);
    await wait(500);
    nc?.openGate();
    this.player.frozen = false;
    this.state = 'playing';
  }

  restartChamber() {
    if (!this.level) return;
    this.story.cancelAll();
    this.level.reset();
    this.tare.stored = 0;
    this.player.setWeight(this.level.def.playerWeight ?? 2, true);
    const s = this.level.entryCage ? this.level.entryCage.toWorld(V(0, 0, -0.3)) : V(...this.level.spawn.pos);
    this.player.teleport([s.x, s.y, s.z], this.level.entryCage ? this.level.entryCage.rotY + Math.PI : this.level.spawn.yaw);
    this.level.entryCage?.openGate();
    this.ui.flash('Chamber restored to its initial state.', 2200);
    this.level.def.restart?.(this.level);
  }

  async playerDied(cause) {
    if (this.dying) return;
    this.dying = true;
    this.stats.deaths++;
    this.player.frozen = true;
    await this.ui.fade(1, 450);
    const s = this.player.lastSafe || { pos: this.level.spawn.pos, yaw: this.level.spawn.yaw };
    if (s.weight !== undefined && s.weight !== this.player.weight) this.player.setWeight(s.weight, true);
    this.player.teleport(s.pos, s.yaw);
    this.player.frozen = false;
    if (cause === 'brine') this.ui.flash('The brine is very cold. You climb back out.', 2600);
    else this.ui.flash('You pick yourself up.', 2000);
    await this.ui.fade(0, 600);
    this.dying = false;
  }

  // ------------------------------------------------------------------ loops
  fixed(dt) {
    if (!this.level) return;
    const playing = this.state === 'playing' || this.state === 'transition';
    if (!playing || this.paused) { this.input.pressed.clear(); this.input.released.clear(); return; }
    const inp = this.inputLocked ? { isDown: () => false, wasPressed: () => false } : this.input;
    this.player.inVent = false;
    this.player.fixedUpdate(dt, inp);
    if (this.tare.enabled) this.tare.fixedUpdate(dt, inp); else if (!this.inputLocked) this.tare.interactOnly(inp);
    this.level.fixedUpdate(dt);
    // hold R to restart the chamber
    if (this.state === 'playing' && this.input.isDown('KeyR') && !this.inputLocked) {
      this.restartHold += dt;
      if (this.restartHold > 1.3) { this.restartHold = -10; this.restartChamber(); }
    } else if (!this.input.isDown('KeyR')) this.restartHold = 0;
    // fell out of the world
    if (this.player.body && !this.dying && (this.player.pos.y < this.level.killY || this.player.pos.y > (this.level.killYTop ?? 1e9))) this.playerDied('fall');
    this.input.pressed.clear(); this.input.released.clear();
  }

  frame(dt, alpha) {
    const eng = this.engine;
    if (!this.level) return;
    if (this.state === 'title') {
      this.titleT = (this.titleT || 0) + dt;
      this.level.def.titleCamera?.(this.level, eng.camera, this.titleT);
      this.level.update(dt);
      this.story.tick(dt);
      this.input.consumeMouse();
      this.listener();
      return;
    }
    if (this.paused) { this.input.consumeMouse(); return; }
    const m = (this.input.locked || this.debugNoLock) && !this.inputLocked ? this.input.consumeMouse() : (this.input.consumeMouse(), { x: 0, y: 0 });
    if (this.state === 'playing' || this.state === 'transition') this.player.look(m.x, m.y);
    this.player.frameUpdate(dt, alpha, this.input);
    this.player.applyCamera(eng.camera);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.5);
      const a = this.shake * 0.006;
      eng.camera.position.x += (Math.random() - 0.5) * a; eng.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.tare.frameUpdate(dt, m);
    this.level.update(dt);
    this.story.tick(dt);
    this.hud();
    this.listener();
  }

  listener() {
    const c = this.engine.camera;
    const f = V(0, 0, -1).applyQuaternion(c.quaternion), u = V(0, 1, 0).applyQuaternion(c.quaternion);
    audio.setListener(c.position, f, u);
  }

  hud() {
    const t = this.tare.target;
    const ui = this.ui;
    if (this.state !== 'playing') { ui.setReticle('hidden'); ui.setReadout(''); return; }
    if (!t || t.kind === 'none') { ui.setReticle(''); ui.setReadout(this.tare.held ? '<span class="key">E</span>Set down · <span class="key">Q</span>Throw' : ''); return; }
    if (t.kind === 'weighted' || t.kind === 'self') {
      const o = t.obj; const w = t.kind === 'self' ? this.player.weight : o.weight;
      const name = t.kind === 'self' ? 'Yourself' : o.label;
      const carry = t.kind === 'weighted' && t.dist < 2.7 && !this.tare.held ? (o.canCarry() ? ' · <span class="key">E</span>Lift' : '') : '';
      ui.setReticle(this.tare.enabled ? 'target' : '');
      ui.setReadout(this.tare.enabled ? `${name}<b class="${w < 0 ? 'neg' : ''}">${w < 0 ? '−' + -w : w}</b>${carry}` : (carry ? carry.replace(' · ', '') : ''));
      return;
    }
    if (t.kind === 'interact') { ui.setReticle('interact'); ui.setReadout(`<span class="key">E</span>${t.obj.prompt || 'Use'}`); return; }
    ui.setReticle(''); ui.setReadout('');
  }

  async ending() {
    this.state = 'ending';
    this.input.unlock();
    this.tare.show(false);
    this.ui.showHud(false);
    this.save.finish();
    await this.ui.fade(1, 3000);
    this.ui.showCredits(async () => { await this.showTitle(); this.ui.fade(0, 1200); }, { ending: true });
    this.ui.fade(0, 100);
  }

  // ------------------------------------------------------------------ debug / test API
  debugApi() {
    const g = this;
    return {
      game: g,
      levels: LEVELS.map(l => l.id),
      async goto(i) { g.ui.hideTitle(true); g.ui.closeForm(); await g.loadLevel(i); g.state = 'playing'; g.ui.showHud(true); g.ui.fade(0, 10); return g.level.id; },
      teleport(x, y, z, yaw = null) { g.player.teleport([x, y, z], yaw); },
      look(yaw, pitch = 0) { g.player.yaw = yaw; g.player.pitch = pitch; },
      lookAt(x, y, z) {
        const e = g.player.eyeNow(V());
        const d = V(x, y, z).sub(e).applyQuaternion(g.player.flipTarget.clone().invert());
        g.player.flip.copy(g.player.flipTarget);
        g.player.yaw = Math.atan2(-d.x, -d.z); g.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      },
      aim() { g.tare.target = g.tare.aim(); const t = g.tare.target; return t ? { kind: t.kind, name: t.obj?.label || t.obj?.name, weight: t.obj?.weight, dist: +t.dist.toFixed(2) } : null; },
      draw() { g.tare.target = g.tare.aim(); g.tare.draw(); return g.tare.stored; },
      give() { g.tare.target = g.tare.aim(); g.tare.give(); return g.tare.stored; },
      use() { g.tare.target = g.tare.aim(); g.tare.interact(); return !!g.tare.held; },
      named(n) { return g.level.named[n]; },
      weights() { return g.level.weighted.map(w => ({ name: w.name, w: w.weight, p: w.position().toArray().map(v => +v.toFixed(2)) })); },
      plates() { return g.level.entities.filter(e => e.kind === 'plate').map(p => ({ need: p.need, load: p.load, on: p.pressed })); },
      doors() { return g.level.entities.filter(e => e.kind === 'door').map(d => +d.open.toFixed(2)); },
      player() { const p = g.player; return { pos: p.feet(V()).toArray().map(v => +v.toFixed(2)), w: p.weight, grounded: p.grounded, stored: g.tare.stored }; },
      noclip(on = true) { g.player.noclip = on; },
      setCapacity(n) { g.tare.setCapacity(n); },
      async steps(n) { for (let i = 0; i < n; i++) await nextFrame(); },
      // run the simulation for `sec` seconds without rendering (deterministic tests)
      // yields between steps so story coroutines resume as they would between frames
      async simulate(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { g.fixed(1 / 60); g.level.update(1 / 60); g.story.tick(1 / 60); for (let k = 0; k < 6; k++) await null; } return g.level.id; },
      place(i, x, y, z) { const w = g.level.weighted[i]; w.body.setTranslation({ x, y, z }, true); w.body.setLinvel({ x: 0, y: 0, z: 0 }, true); w.body.setAngvel({ x: 0, y: 0, z: 0 }, true); },
      setW(i, v) { g.level.weighted[i].setWeight(v); },
      // press jump on the next fixed step and report the highest point reached
      async jumpHeight(sec = 2.5) { const y0 = g.player.feet(new THREE.Vector3()).y; g.input.pressed.add('Space'); let top = y0; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { g.fixed(1 / 60); g.level.update(1 / 60); top = Math.max(top, g.player.feet(new THREE.Vector3()).y); for (let k = 0; k < 4; k++) await null; } return +(top - y0).toFixed(2); },
      named(n) { return g.level.named[n]; },
      cageOpen() { return g.level.exitCage ? +g.level.exitCage.open.toFixed(2) : null; },
    };
  }
}
