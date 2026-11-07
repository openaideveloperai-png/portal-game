// The tare: aiming, drawing/giving measures, carrying objects, interacting, and the
// first-person instrument (viewmodel). Its read-out is diegetic: glass vials on the
// housing fill with a dark fluid for every measure it holds.
import * as THREE from 'three';
import { GROUPS, R } from '../core/physics.js';
import { audio } from '../core/audio.js';
import { clamp, damp, lerp } from '../core/util.js';
import { dialTexture } from '../render/signs.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RANGE = 14;
const REACH = 2.7;

export class Tare {
  constructor(game) {
    this.game = game;
    this.stored = 0;
    this.capacity = 1;
    this.debtUnlocked = false;
    this.enabled = false;      // the player doesn't have it during the prologue
    this.held = null;
    this.target = null;        // { kind, obj, point, dist, collider }
    this.recoil = 0; this.ring = 0; this.ringDir = 0;
    this.sway = V(); this.swayVel = V();
    this.effects = [];
    this.msg = null;
    this.buildViewmodel();
  }

  // ------------------------------------------------------------------ viewmodel
  buildViewmodel() {
    const eng = this.game.engine;
    const mats = eng.materials;
    const root = new THREE.Group();
    root.position.set(0.2, -0.22, -0.5);
    root.rotation.set(0.0, 0.3, 0.0);
    root.scale.setScalar(0.8);
    eng.viewCamera.add(root);
    this.vm = root;
    const inst = new THREE.Group();
    root.add(inst);
    this.inst = inst;
    // grip (lathe with finger grooves)
    const gp = [];
    const pts = [[0.0, -0.075], [0.014, -0.075], [0.019, -0.068], [0.019, -0.052], [0.016, -0.046], [0.019, -0.036], [0.019, -0.024], [0.016, -0.018], [0.019, -0.008], [0.019, 0.004], [0.016, 0.01], [0.018, 0.02], [0.017, 0.032], [0.0, 0.034]];
    for (const [x, y] of pts) gp.push(new THREE.Vector2(x, y));
    const grip = new THREE.Mesh(new THREE.LatheGeometry(gp, 24), mats.get('bakelite'));
    grip.rotation.x = 0.28;
    grip.position.set(0, -0.02, 0.0);
    inst.add(grip);
    // housing
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.11, 28), mats.get('brass'));
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 0.035, -0.035);
    inst.add(housing);
    for (const z of [-0.09, 0.02]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 28), mats.get('brass'));
      cap.rotation.x = Math.PI / 2; cap.position.set(0, 0.035, z); inst.add(cap);
    }
    // knurled adjustment ring
    const knurl = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.016, 36), mats.get('steel_dark'));
    knurl.rotation.x = Math.PI / 2; knurl.position.set(0, 0.035, -0.06); inst.add(knurl);
    // fork prongs with tuning weights
    this.prongs = [];
    for (const x of [-0.011, 0.011]) {
      const pr = new THREE.Group();
      pr.position.set(x, 0.035, -0.095);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, 0.14, 10), mats.get('brass'));
      rod.rotation.x = Math.PI / 2; rod.position.z = -0.07; pr.add(rod);
      const wgt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 12), mats.get('steel'));
      wgt.rotation.x = Math.PI / 2; wgt.position.z = -0.1; pr.add(wgt);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), mats.get('brass'));
      tip.position.z = -0.14; pr.add(tip);
      inst.add(pr);
      this.prongs.push(pr);
    }
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.012, 0.012), mats.get('brass'));
    yoke.position.set(0, 0.035, -0.096); inst.add(yoke);
    // side gauge: reads whatever you aim at
    const { texture, angle } = dialTexture({ min: -4, max: 8, label: 'AIM', size: 256 });
    this.gaugeAngle = angle;
    const gauge = new THREE.Group();
    gauge.position.set(-0.034, 0.04, -0.03);
    gauge.rotation.set(0, -Math.PI / 2 + 0.35, 0);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.019, 28), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4 }));
    face.position.z = 0.003; gauge.add(face);
    const gb = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 24), mats.get('brass'));
    gb.rotation.x = Math.PI / 2; gauge.add(gb);
    this.needle = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.016, 0.001), mats.plain('#8f241a', {}));
    this.needle.geometry.translate(0, 0.007, 0);
    this.needle.position.z = 0.005; gauge.add(this.needle);
    inst.add(gauge);
    this.needleVal = 0; this.needleShown = 0; this.needleVel = 0;
    // vials for stored measures (built when capacity changes)
    this.vialGroup = new THREE.Group();
    this.vialGroup.position.set(0, 0.066, -0.035);
    inst.add(this.vialGroup);
    this.vials = [];
    this.setCapacity(this.capacity);
    // serial plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.002), mats.get('steel'));
    plate.position.set(0.031, 0.03, -0.04); plate.rotation.y = Math.PI / 2; inst.add(plate);
    // the hand goes here once characters are loaded
    this.handSlot = new THREE.Group();
    root.add(this.handSlot);
    root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    // a soft key light so the instrument reads in dark rooms
    const key = new THREE.DirectionalLight('#ffe9cc', 0.9); key.position.set(-1, 2, 1);
    eng.viewScene.add(key);
    const fill = new THREE.HemisphereLight('#c9d0d4', '#3a3029', 0.6);
    eng.viewScene.add(fill);
    this.vmKey = key; this.vmFill = fill;
    root.visible = false;
  }

  setCapacity(n) {
    this.capacity = n;
    const mats = this.game.engine.materials;
    for (const v of this.vials) this.vialGroup.remove(v.g);
    this.vials = [];
    const gap = 0.017;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      g.position.set((i - (n - 1) / 2) * gap, 0, 0);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.028, 14, 1, true), mats.glass({ opacity: 0.28, tint: '#dfe8e2' }));
      g.add(glass);
      const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.026, 14), new THREE.MeshStandardMaterial({ color: '#2b2622', metalness: 0.9, roughness: 0.15 }));
      fluid.geometry.translate(0, 0.013, 0);
      fluid.position.y = -0.013;
      fluid.scale.y = 0.001;
      g.add(fluid);
      for (const y of [-0.0155, 0.0155]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.004, 14), mats.get('brass'));
        cap.position.y = y; g.add(cap);
      }
      this.vialGroup.add(g);
      this.vials.push({ g, fluid, level: 0 });
    }
  }

  attachHand(hand) {
    this.handSlot.clear();
    if (hand) this.handSlot.add(hand);
  }

  show(on) { this.vm.visible = on; }

  // ------------------------------------------------------------------ aiming
  aim() {
    const game = this.game, p = game.player;
    if (!p.body) return null;
    const eye = p.eyeNow(V());
    const dir = p.forwardWorld(V());
    const hit = game.level.phys.raycast(eye, dir, RANGE, { filter: GROUPS.aim, exclude: p.collider });
    if (!hit) return null;
    const info = hit.info || {};
    const o = info.owner;
    const t = { point: hit.point, dist: hit.dist, collider: hit.collider, info };
    if (info.kind === 'boothDial' && o && o.contains(o.post ? p.pos.clone() : p.feet(V()))) return { ...t, kind: 'self', obj: p, booth: o };
    if (o && o.weighted) return { ...t, kind: 'weighted', obj: o };
    if (o && o.interact && hit.dist < REACH + 0.4) return { ...t, kind: 'interact', obj: o };
    return { ...t, kind: 'none', obj: null };
  }

  // ------------------------------------------------------------------ actions
  say(text, ms = 1600) { this.game.ui.flash(text, ms); }

  draw() {
    const t = this.target;
    if (!t || (t.kind !== 'weighted' && t.kind !== 'self')) { audio.play('tareFail'); this.recoil = 0.4; return; }
    if (this.stored >= this.capacity) { audio.play('tareFail'); this.say('The tare is full.'); this.recoil = 0.4; return; }
    const o = t.obj;
    const w = t.kind === 'self' ? this.game.player.weight : o.weight;
    const min = t.kind === 'self' ? t.booth.range[0] : o.min;
    if (w - 1 < 0 && !this.debtUnlocked) { audio.play('tareFail'); this.say('Debt latch engaged — cannot draw below zero.', 2200); this.recoil = 0.4; return; }
    if (w - 1 < min) { audio.play('tareFail'); this.say(t.kind === 'self' ? 'Outside the permitted range for this booth.' : 'Nothing more can be drawn from that.'); this.recoil = 0.4; return; }
    if (t.kind === 'self') this.game.player.setWeight(w - 1);
    else o.setWeight(w - 1);
    this.stored++;
    this.fx(false, t);
    audio.play('tare', { give: false, stored: this.stored });
    this.game.stats.draws++;
    this.afterChange(t);
  }

  give() {
    const t = this.target;
    if (!t || (t.kind !== 'weighted' && t.kind !== 'self')) { audio.play('tareFail'); this.recoil = 0.4; return; }
    if (this.stored <= 0) { audio.play('tareFail'); this.say('The tare is empty.'); this.recoil = 0.4; return; }
    const o = t.obj;
    const w = t.kind === 'self' ? this.game.player.weight : o.weight;
    const max = t.kind === 'self' ? t.booth.range[1] : o.max;
    if (w + 1 > max) { audio.play('tareFail'); this.say(t.kind === 'self' ? 'Outside the permitted range for this booth.' : 'It will take no more.'); this.recoil = 0.4; return; }
    if (t.kind === 'self') this.game.player.setWeight(w + 1);
    else o.setWeight(w + 1);
    this.stored--;
    this.fx(true, t);
    audio.play('tare', { give: true, stored: this.stored });
    this.game.stats.gives++;
    this.afterChange(t);
  }

  afterChange(t) {
    this.ring = 1; this.recoil = 1;
    if (this.held && this.held.weight > 2) { this.say('Too heavy to hold now.'); this.drop(); }
    this.game.onWeightAction?.(t);
  }

  interact() {
    if (this.held) { this.drop(); return; }
    const t = this.target;
    if (!t || !t.obj) return;
    if (t.kind === 'interact' && t.dist < REACH + 0.4) { t.obj.interact(); return; }
    if (t.kind === 'weighted' && t.dist < REACH) {
      const o = t.obj;
      if (o.canCarry()) this.pick(o);
      else if (o.body && !o.fixed && o.carriable) { audio.play('tareFail'); this.say(`Too heavy to lift — ${o.weight} measures.`); }
    }
  }

  pick(o) {
    this.held = o;
    o.held = true;
    o.collider.setCollisionGroups(GROUPS.held);
    o.applyGravity();
    audio.play('cloth', { gain: 0.8 });
    this.holdFail = 0;
  }

  drop(throwSpeed = 0) {
    const o = this.held;
    if (!o) return;
    this.held = null;
    o.held = false;
    o.collider.setCollisionGroups(GROUPS.dynamic);
    o.applyGravity();
    const p = this.game.player;
    const f = p.forwardWorld(V());
    const v = o.body.linvel();
    o.body.setLinvel({ x: v.x * 0.5 + p.vel.x * 0.6 + f.x * throwSpeed, y: v.y * 0.3 + f.y * throwSpeed, z: v.z * 0.5 + p.vel.z * 0.6 + f.z * throwSpeed }, true);
    o.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  shove() {
    if (this.held) { this.drop(6); audio.play('cloth', { gain: 1 }); return; }
    const t = this.target;
    if (t && t.kind === 'weighted' && t.dist < REACH && t.obj.body && !t.obj.fixed) {
      const f = this.game.player.forwardWorld(V());
      const k = 120 / Math.max(1, Math.abs(t.obj.weight));
      t.obj.body.applyImpulse({ x: f.x * k, y: Math.max(0, f.y) * k * 0.5 + 20, z: f.z * k }, true);
      audio.play('impact', { intensity: 0.4, weight: t.obj.weight, pos: t.point });
    }
  }

  // ------------------------------------------------------------------ per-step logic
  fixedUpdate(dt, input) {
    if (!this.enabled || this.game.paused || this.game.inputLocked) return;
    this.target = this.aim();
    if (input.wasPressed('Mouse0')) this.draw();
    if (input.wasPressed('Mouse2')) this.give();
    if (input.wasPressed('KeyE')) this.interact();
    if (input.wasPressed('KeyQ')) this.shove();
    this.holdStep(dt);
  }

  // Interaction (E) works even before the instrument is issued.
  interactOnly(input) {
    this.target = this.aim();
    if (input.wasPressed('KeyE')) this.interact();
    this.holdStep(1 / 60);
  }

  holdStep(dt) {
    const o = this.held;
    if (!o) return;
    if (!o.body) { this.held = null; return; }
    const p = this.game.player;
    const eye = p.eyeNow(V());
    const f = p.forwardWorld(V());
    const dist = 1.15 + o.size * 0.5;
    const target = eye.clone().addScaledVector(f, dist);
    const feetY = p.feet(V()).y;
    if (!p.inverted) target.y = Math.max(target.y, feetY + o.size * 0.5 + 0.05);
    const t = o.body.translation();
    const d = V(target.x - t.x, target.y - t.y, target.z - t.z);
    const err = d.length();
    const v = d.multiplyScalar(14);
    if (v.length() > 12) v.setLength(12);
    o.body.setLinvel({ x: v.x + p.vel.x * 0.2, y: v.y, z: v.z + p.vel.z * 0.2 }, true);
    // keep the crate square to the view
    const qt = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.yaw).premultiply(p.flip);
    const r = o.body.rotation();
    const qc = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    // nearest 90° yaw so it doesn't spin around
    const diff = qt.clone().multiply(qc.clone().invert());
    if (diff.w < 0) { diff.x *= -1; diff.y *= -1; diff.z *= -1; diff.w *= -1; }
    const angle = 2 * Math.acos(clamp(diff.w, -1, 1));
    const s = Math.sqrt(1 - diff.w * diff.w);
    const axis = s > 1e-4 ? V(diff.x / s, diff.y / s, diff.z / s) : V(0, 1, 0);
    const snap = angle % (Math.PI / 2);
    const use = snap > Math.PI / 4 ? snap - Math.PI / 2 : snap;
    const w = axis.multiplyScalar(use * 8);
    o.body.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
    if (err > 1.6) { this.holdFail += dt; if (this.holdFail > 0.3) this.drop(); } else this.holdFail = 0;
  }

  // ------------------------------------------------------------------ effects
  fx(give, t) {
    const game = this.game;
    const cam = game.engine.camera;
    const start = V(0.16, -0.13, -0.55).applyQuaternion(cam.quaternion).add(cam.position);
    const end = t.kind === 'self' ? cam.position.clone().add(V(0, -0.9, 0)) : (t.obj.position ? t.obj.position(V()) : t.point.clone());
    if (t.kind === 'weighted') t.obj.shake = 0.35;
    const from = give ? start : end, to = give ? end : start;
    const mat = new THREE.MeshBasicMaterial({ color: '#efe2c4', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
    const len = from.distanceTo(to);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0035, 4, 28), mat.clone());
      ring.position.copy(from);
      ring.lookAt(to);
      game.level.root.add(ring);
      this.effects.push({ m: ring, from: from.clone(), to: to.clone(), t: -i * 0.06, dur: 0.18 + len * 0.025 });
    }
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      e.t += dt;
      const k = clamp(e.t / e.dur, 0, 1);
      e.m.position.lerpVectors(e.from, e.to, k);
      const s = 1 + Math.sin(k * Math.PI) * 2.2;
      e.m.scale.setScalar(s);
      e.m.material.opacity = e.t < 0 ? 0 : Math.sin(k * Math.PI) * 0.32;
      if (k >= 1) { e.done = true; e.m.parent?.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); }
    }
    this.effects = this.effects.filter(e => !e.done);
  }

  // ------------------------------------------------------------------ per-frame visuals
  frameUpdate(dt, mouse) {
    this.updateEffects(dt);
    if (!this.vm.visible) return;
    const p = this.game.player;
    // weapon sway: lag behind the view, spring back
    this.swayVel.x += (-mouse.x * 0.6 - this.sway.x) * 60 * dt;
    this.swayVel.y += (mouse.y * 0.6 - this.sway.y) * 60 * dt;
    this.swayVel.multiplyScalar(Math.exp(-14 * dt));
    this.sway.addScaledVector(this.swayVel, dt);
    this.sway.x = clamp(this.sway.x, -0.06, 0.06); this.sway.y = clamp(this.sway.y, -0.05, 0.05);
    const hs = Math.hypot(p.vel.x, p.vel.z);
    const bob = p.grounded ? Math.sin(p.stride / 1.75 * Math.PI * 2) * 0.006 * Math.min(1, hs / 4) : 0;
    const bobX = p.grounded ? Math.cos(p.stride / 1.75 * Math.PI) * 0.005 * Math.min(1, hs / 4) : 0;
    this.recoil = damp(this.recoil, 0, 9, dt);
    this.ring = Math.max(0, this.ring - dt * 1.4);
    const holding = !!this.held;
    const base = holding ? V(0.24, -0.3, -0.48) : V(0.2, -0.22, -0.5);
    this.vm.position.set(base.x + this.sway.x * 0.4 + bobX, base.y + this.sway.y * 0.4 + bob - p.landDip * 0.3, base.z + this.recoil * 0.025);
    this.vm.rotation.set(-0.08 + this.recoil * 0.12 + this.sway.y, 0.32 + this.sway.x, 0.03 + this.sway.x * 0.5);
    for (let i = 0; i < 2; i++) this.prongs[i].rotation.y = Math.sin(performance.now() * 0.09 + i * Math.PI) * 0.03 * this.ring;
    // gauge reads the aimed object's weight
    const t = this.target;
    this.needleVal = t && t.kind === 'weighted' ? t.obj.weight : t && t.kind === 'self' ? p.weight : 0;
    const a = (this.needleVal - this.needleShown) * 80 - this.needleVel * 10;
    this.needleVel += a * dt; this.needleShown += this.needleVel * dt;
    this.needle.rotation.z = this.gaugeAngle(clamp(this.needleShown, -4.3, 8.3));
    this.vials.forEach((v, i) => {
      const full = i < this.stored ? 1 : 0;
      v.level = damp(v.level, full, 7, dt);
      v.fluid.scale.y = Math.max(0.001, v.level);
    });
  }
}
