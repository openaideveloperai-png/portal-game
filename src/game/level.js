// Level runtime + builder DSL. A level definition is { id, title, ledger, build(L) }.
// build() describes geometry, lights and elements through the methods below.
import * as THREE from 'three';
import { PhysicsWorld, R, GROUPS } from '../core/physics.js';
import { boxGeom, splitWall, StaticBatch } from '../render/geometry.js';
import { Props } from '../render/props.js';
import { WORLD } from '../render/materials.js';
import { Crate, Anchor } from './weights.js';
import { Plate, Door, Wire, Lift, Vent, Glass, Brine, Booth, Hopper, Button, Lever, Launcher, Note, Trigger, Cage, Dial, Twins, House, cond } from './elements.js';
import { hashString, rng, clamp } from '../core/util.js';
import { audio } from '../core/audio.js';
import { FONTS, INK } from '../render/signs.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

function norm(min, max) {
  return [[Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])], [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])]];
}

export class Level {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.seed = hashString(def.id);
    this.R = R;
    this.root = new THREE.Group();
    this.root.name = 'level:' + def.id;
    this.phys = new PhysicsWorld();
    this.phys.onImpact = (info, mag, p) => this.onImpact(info, mag, p);
    this.batch = new StaticBatch();
    this.props = new Props(this);
    this.entities = [];
    this.weighted = [];
    this.lights = [];
    this.flickers = [];
    this.named = {};
    this.spawn = { pos: [0, 0, 0], yaw: 0 };
    this.killY = -30;
    this.ambience = { room: 0.5, drips: 0.4, creaks: 0.2, knocks: 0.15, every: 4 };
    this.reverb = 'room';
    this.loops = [];
    this.updaters = [];
    this.focus = null;
    this.wet = 0;
    this.started = false;
    this.lightBudget = 0;
  }

  // ------------------------------------------------------------------ materials
  mat(name, o) { return this.game.engine.materials.get(name, o); }

  // ------------------------------------------------------------------ solids
  // axis-aligned solid with collider. opts: bevel, surface, grime, uvScale, collide, group, visible
  solid(min, max, mat, opts = {}) {
    [min, max] = norm(min, max);
    if (opts.visible !== false) {
      const g = boxGeom(min, max, opts);
      this.batch.add(g, typeof mat === 'string' ? this.mat(mat) : mat, { castShadow: opts.shadow !== false });
    }
    if (opts.collide !== false) {
      const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
      const h = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
      return this.phys.fixedBox(c, h, { info: { kind: 'static', surface: opts.surface || surfaceOf(mat), unsafe: opts.unsafe }, group: opts.group || GROUPS.static });
    }
    return null;
  }
  visual(min, max, mat, opts = {}) { return this.solid(min, max, mat, { ...opts, collide: false }); }
  // a solid described in a local frame (origin + yaw)
  solidLocal(origin, rotY, min, max, mat, opts = {}) {
    [min, max] = norm(min, max);
    const c = V((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2).applyAxisAngle(UP, rotY).add(V(...origin));
    const h = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    if (opts.visible !== false) {
      const g = boxGeom([-h[0], -h[1], -h[2]], [h[0], h[1], h[2]], { ...opts, grime: opts.grime === undefined ? [c.y - h[1], c.y + h[1]] : opts.grime, rotY: 0 });
      // rotate around the box centre then move there (UVs stay world-projected)
      const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(c);
      g.applyMatrix4(m);
      reprojectUV(g, opts.uvScale ?? 1);
      this.batch.add(g, typeof mat === 'string' ? this.mat(mat) : mat, { castShadow: opts.shadow !== false });
    }
    if (opts.collide === false) return null;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, rotY);
    return this.phys.fixedBox(c.toArray(), h, { rot: { x: q.x, y: q.y, z: q.z, w: q.w }, info: { kind: 'static', surface: opts.surface || surfaceOf(mat) }, group: opts.group || GROUPS.static });
  }
  visualLocal(origin, rotY, min, max, mat, opts = {}) { return this.solidLocal(origin, rotY, min, max, mat, { ...opts, collide: false }); }

  // invisible blockers
  clip(min, max, { player = true, crates = true } = {}) {
    [min, max] = norm(min, max);
    const group = player && crates ? GROUPS.static : player ? GROUPS.playerOnly : GROUPS.crateOnly;
    return this.solid(min, max, null, { visible: false, group });
  }

  // A rectangular room. Interior box [min,max]; walls/floor/ceiling are built outside it.
  // open: { 'x-': [[a0,a1,y0,y1], ...], 'x+': ..., 'z-': ..., 'z+': ... } (a = z for x walls, x for z walls)
  // holes: floor holes [[x0,z0,x1,z1], ...]; ceilHoles likewise.
  room({ min, max, floor = 'terrazzo', wall = 'plaster_cream', ceiling = 'plaster_grey', dado = null, dadoH = 1.3, rail = 'veneer_oak', t = 0.4, open = {}, holes = [], ceilHoles = [], noCeiling = false, noFloor = false, skirting = 'paint_black', walls = ['x-', 'x+', 'z-', 'z+'], wallMats = {}, inner = null }) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    if (!noFloor) for (const [a0, a1, b0, b1] of splitRect(x0 - t, x1 + t, z0 - t, z1 + t, holes)) this.solid([a0, y0 - t, b0], [a1, y0, b1], floor, { surface: surfaceOf(floor), grime: false });
    if (!noCeiling) for (const [a0, a1, b0, b1] of splitRect(x0 - t, x1 + t, z0 - t, z1 + t, ceilHoles)) this.solid([a0, y1, b0], [a1, y1 + t, b1], ceiling, { grime: false });
    const sides = {
      'x-': { axis: 'z', a0: z0 - t, a1: z1 + t, plane: x0, out: -1 },
      'x+': { axis: 'z', a0: z0 - t, a1: z1 + t, plane: x1, out: 1 },
      'z-': { axis: 'x', a0: x0, a1: x1, plane: z0, out: -1 },
      'z+': { axis: 'x', a0: x0, a1: x1, plane: z1, out: 1 },
    };
    for (const name of walls) {
      const s = sides[name];
      const ops = open[name] || [];
      const wm = wallMats[name] || wall;
      const pieces = splitWall(s.a0, s.a1, y0, y1, ops);
      for (const [a, b, ya, yb] of pieces) {
        const pmin = s.axis === 'z' ? [s.out < 0 ? s.plane - t : s.plane, ya, a] : [a, ya, s.out < 0 ? s.plane - t : s.plane];
        const pmax = s.axis === 'z' ? [s.out < 0 ? s.plane : s.plane + t, yb, b] : [b, yb, s.out < 0 ? s.plane : s.plane + t];
        this.solid(pmin, pmax, wm, { grime: [y0, y1] });
      }
      // dado tiles (an overlay, proud of the wall like real tiles) + rail, or a skirting
      const inner = s.plane;
      const d = s.out < 0 ? 0.018 : -0.018;
      const ia0 = s.axis === 'z' ? z0 : x0, ia1 = s.axis === 'z' ? z1 : x1;
        if (arguments[0].inner) {
        // interior finish over a structural wall (e.g. plaster inside a concrete shell)
        const fy0 = dado ? y0 + dadoH : y0;
        for (const [a, b, ya, yb] of splitWall(ia0, ia1, fy0, y1, ops)) {
          const mn = s.axis === 'z' ? [inner, ya, a] : [a, ya, inner];
          const mx = s.axis === 'z' ? [inner + d * 0.5, yb, b] : [b, yb, inner + d * 0.5];
          this.visual(mn, mx, arguments[0].inner, { grime: [y0, y1] });
        }
      }
      if (dado) {
        const dp = splitWall(ia0, ia1, y0, y0 + dadoH, ops);
        for (const [a, b, ya, yb] of dp) {
          const mn = s.axis === 'z' ? [inner, ya, a] : [a, ya, inner];
          const mx = s.axis === 'z' ? [inner + d, yb, b] : [b, yb, inner + d];
          this.visual(mn, mx, dado, { grime: [y0, y0 + dadoH + 1.5] });
          if (Math.abs(yb - (y0 + dadoH)) < 1e-3 && rail) {
            const rmn = s.axis === 'z' ? [inner, yb - 0.01, a] : [a, yb - 0.01, inner];
            const rmx = s.axis === 'z' ? [inner + d * 2.2, yb + 0.035, b] : [b, yb + 0.035, inner + d * 2.2];
            this.visual(rmn, rmx, rail, { bevel: 0.006, grime: false });
          }
        }
      } else if (skirting) {
        const sp = splitWall(ia0, ia1, y0, y0 + 0.12, ops);
        for (const [a, b, ya, yb] of sp) {
          const mn = s.axis === 'z' ? [inner, ya, a] : [a, ya, inner];
          const mx = s.axis === 'z' ? [inner + d * 0.9, yb, b] : [b, yb, inner + d * 0.9];
          this.visual(mn, mx, skirting, { bevel: 0.004, grime: false });
        }
      }
    }
  }

  // Where a lift cage sits for a room wall. Returns { pos, rotY, open } where `open`
  // is the opening rectangle to pass to room({ open: { [wall]: [spot.open] } }).
  cageSpot(room, wall, a, { t = 0.4, y = null } = {}) {
    const [x0, , z0] = room.min, [x1, , z1] = room.max;
    const y0 = y ?? room.min[1];
    const off = t + 1.2;
    const spots = {
      'z-': { pos: [a, y0, z0 - off], rotY: 0 },
      'z+': { pos: [a, y0, z1 + off], rotY: Math.PI },
      'x-': { pos: [x0 - off, y0, a], rotY: Math.PI / 2 },
      'x+': { pos: [x1 + off, y0, a], rotY: -Math.PI / 2 },
    };
    return { ...spots[wall], wall, open: [a - 1.2, a + 1.2, y0, y0 + 2.75] };
  }

  cageToWorld(spot, local) {
    const v = V(...local).applyAxisAngle(UP, spot.rotY).add(V(...spot.pos));
    return [v.x, v.y, v.z];
  }

  // ------------------------------------------------------------------ lights
  addLight(light, { flicker = false, minor = false } = {}) {
    this.root.add(light);
    if (light.target && !light.target.parent) this.root.add(light.target);
    this.lights.push(light);
    if (flicker) this.flickers.push({ light, base: light.intensity, t: 0, next: 2 + Math.random() * 6 });
    return light;
  }
  shadowSpot(light, target) {
    light.castShadow = true;
    const q = this.game.engine.q;
    light.shadow.mapSize.set(q.shadow, q.shadow);
    light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03;
    light.shadow.camera.near = 0.2; light.shadow.camera.far = light.distance || 30;
    light.shadow.radius = 3;
    light.target.position.set(...target);
    this.root.add(light.target);
  }
  sun({ dir = [-0.4, -1, -0.3], color = '#cfd8e0', intensity = 0.6, shadow = true, area = 30, at = [0, 0, 0] } = {}) {
    const l = new THREE.DirectionalLight(color, intensity);
    const d = V(...dir).normalize();
    l.position.set(at[0] - d.x * 40, at[1] - d.y * 40, at[2] - d.z * 40);
    l.target.position.set(...at);
    if (shadow) {
      l.castShadow = true;
      const q = this.game.engine.q;
      l.shadow.mapSize.set(q.shadow, q.shadow);
      const c = l.shadow.camera; c.left = -area; c.right = area; c.top = area; c.bottom = -area; c.near = 1; c.far = 120;
      l.shadow.bias = -0.0005; l.shadow.normalBias = 0.04;
    }
    this.addLight(l);
    return l;
  }
  hemi(sky = '#d2d3cc', ground = '#8a7c68', intensity = 1.0) {
    const h = new THREE.HemisphereLight(sky, ground, intensity);
    this.addLight(h);
    return h;
  }
  point(pos, { color = '#ffd8a8', intensity = 6, distance = 10 } = {}) {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(...pos);
    return this.addLight(l);
  }
  // Soft, nearly uniform fill inside a room: stands in for light bouncing off floors and walls.
  fill(pos, { radius = 12, color = '#ffe2bd', intensity = 1.6 } = {}) {
    const l = new THREE.PointLight(color, intensity, radius, 0.35);
    l.position.set(...pos);
    return this.addLight(l);
  }
  fog(color = '#16130f', density = 0.02) { this.fogSpec = { color, density }; }
  env(intensity = 0.35) { this.envIntensity = intensity; }
  exposure(v = 1) { this.exposureValue = v; }

  // ------------------------------------------------------------------ element factories
  crate(o) { const c = new Crate(this, o); this.entities.push(c); this.weighted.push(c); return c; }
  anchor(o) { const a = new Anchor(this, o); this.entities.push(a); this.weighted.push(a); return a; }
  plate(o) { return new Plate(this, o); }
  door(o) { return new Door(this, o); }
  wire(o) { return new Wire(this, o); }
  lift(o) { return new Lift(this, o); }
  vent(o) { return new Vent(this, o); }
  glass(o) { return new Glass(this, o); }
  brine(o) { return new Brine(this, o); }
  booth(o) { return new Booth(this, o); }
  hopper(o) { return new Hopper(this, o); }
  button(o) { return new Button(this, o); }
  lever(o) { return new Lever(this, o); }
  launcher(o) { return new Launcher(this, o); }
  twins(a, b, o = {}) { return new Twins(this, { a, b, ...o }); }
  house(o) { return new House(this, o); }
  note(o) { return new Note(this, o); }
  trigger(o) { return new Trigger(this, o); }
  dial(o) { const d = new Dial(this, o); this.updaters.push(dt => d.update(dt)); return d; }
  cage(o) { const c = new Cage(this, o); if (o.role === 'entry') this.entryCage = c; else this.exitCage = c; return c; }
  // characters & mannequins are created through game.characters (see characters.js)
  npc(o) { return this.game.characters.spawnNPC(this, o); }
  mannequin(o) { return this.game.characters.spawnMannequin(this, o); }
  refPerson(o) { const r = this.game.characters.spawnRefPerson(this, o); this.weighted.push(r); return r; }

  // an invisible "press E here" volume (picking something up, a switch inside a prop)
  interactable({ pos, half = [0.25, 0.15, 0.25], prompt = 'Use', onUse }) {
    const obj = { interact: () => onUse?.(), prompt, kind: 'interactable', enabled: true };
    this.phys.fixedCollider(R.ColliderDesc.cuboid(...half).setTranslation(...pos), { kind: 'interact', owner: obj, interact: true }, GROUPS.rayOnly);
    return obj;
  }

  onUpdate(fn) { this.updaters.push(fn); }
  every(fn) { this.updaters.push(fn); }

  weightedByBody(b) { return this.weighted.find(w => w.body && w.body.handle === b.handle); }

  // ------------------------------------------------------------------ story hooks (forwarded)
  say(...a) { return this.game.story.say(...a); }
  run(fn) { return this.game.story.run(fn); }

  // ------------------------------------------------------------------ runtime
  build() {
    this.def.build(this);
    this.game.characters?.finalize?.(this);
    this.batch.build(this.root);
    this.game.engine.scene.add(this.root);
    this.root.updateMatrixWorld(true);
  }

  start() {
    this.started = true;
    const eng = this.game.engine;
    const f = this.fogSpec;
    eng.scene.fog = f ? new THREE.FogExp2(f.color, f.density) : null;
    eng.scene.background = new THREE.Color(f ? f.color : '#0b0a09');
    eng.scene.environmentIntensity = this.envIntensity ?? 0.6;
    eng.renderer.toneMappingExposure = this.exposureValue ?? 1;
    WORLD.uWet.value = this.wet;
    audio.setReverb(this.reverb);
    const a = this.ambience;
    if (a.room) this.loops.push(audio.loop('room', { gain: a.room * 0.6 }));
    if (a.rain) this.loops.push(audio.loop('rain', { gain: a.rain }));
    if (a.wind) this.loops.push(audio.loop('wind', { gain: a.wind }));
    if (a.machine) this.loops.push(audio.loop('machine', { gain: a.machine, pos: a.machinePos ? V(...a.machinePos) : null }));
    if (a.water) this.loops.push(audio.loop('water', { gain: a.water, pos: a.waterPos ? V(...a.waterPos) : null }));
    if (a.drone) this.loops.push(audio.loop('drone', { gain: a.drone }));
    this.def.start?.(this);
  }

  fixedUpdate(dt) {
    for (const e of this.entities) e.fixedUpdate?.(dt);
    this.phys.step();
    // lost objects (fell out of the world)
    for (const w of this.weighted) {
      if (!w.body || w.fixed) continue;
      const t = w.body.translation();
      if (t.y < this.killY) this.lostObject(w);
    }
    this.def.fixed?.(this, dt);
  }

  update(dt) {
    for (const e of this.entities) e.update?.(dt);
    for (const fn of this.updaters) fn(dt);
    for (const f of this.flickers) {
      f.t += dt;
      if (f.t > f.next) { f.light.intensity = f.base * (Math.random() < 0.5 ? 0.1 : 0.6); if (f.t > f.next + 0.08 + Math.random() * 0.2) { f.light.intensity = f.base; f.t = 0; f.next = 1.5 + Math.random() * 8; } }
    }
    audio.ambientTick(dt, this.ambience);
    this.def.update?.(this, dt);
  }

  onImpact(info, mag, p) {
    const o = info.owner;
    const now = performance.now();
    if (o) { if (o._lastImpact && now - o._lastImpact < 120) return; o._lastImpact = now; }
    const intensity = clamp((mag - 1400) / 9000, 0.08, 1.2);
    audio.play('impact', { intensity, weight: o?.weight ?? 2, pos: p ? V(p.x, p.y, p.z) : null, material: info.material || 'wood' });
  }

  lostObject(o) {
    if (this.game.tare.held === o) this.game.tare.drop();
    if (o.hopper) o.hopper.drop();
    else if (o.respawn) o.respawn(true);
    this.game.ui.flash('Lost ballast retrieved and reset to stock.', 2400);
  }

  reset() {
    if (this.game.tare.held) this.game.tare.drop();
    for (const w of this.weighted) { if (w.respawn) w.respawn(true); else if (w.setWeight) w.setWeight(w.initialWeight, { silent: true }); }
    for (const e of this.entities) e.reset?.();
    this.def.reset?.(this);
  }

  dispose() {
    for (const l of this.loops) l?.stop(0.4);
    for (const e of this.entities) e.dispose?.();
    this.def.dispose?.(this);
    this.onDispose?.();
    this.game.engine.scene.remove(this.root);
    this.root.traverse(o => {
      if (o.isMesh || o.isPoints) {
        o.geometry?.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m && !m.userData?.history && !this.game.engine.materials.cache.has?.(m)) { /* shared materials stay cached */ }
      }
      if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
    });
    this.phys.dispose();
  }

  // a ruled ledger page with a few handwritten entries (used by open ledgers on desks)
  ledgerPageTexture() {
    if (this._ledgerTex) return this._ledgerTex;
    const c = document.createElement('canvas'); c.width = 256; c.height = 360;
    const x = c.getContext('2d');
    x.fillStyle = '#ece4cd'; x.fillRect(0, 0, 256, 360);
    x.strokeStyle = 'rgba(80,110,140,0.45)'; x.lineWidth = 1;
    for (let y = 30; y < 360; y += 14) { x.beginPath(); x.moveTo(8, y); x.lineTo(248, y); x.stroke(); }
    x.strokeStyle = 'rgba(160,60,50,0.5)';
    for (const vx of [40, 180, 215]) { x.beginPath(); x.moveTo(vx, 10); x.lineTo(vx, 350); x.stroke(); }
    const r = rng(this.seed);
    x.fillStyle = 'rgba(30,30,45,0.85)';
    x.font = `16px ${FONTS.hand}`;
    for (let y = 28; y < 340; y += 14) {
      if (r() < 0.25) continue;
      x.fillText(String(Math.floor(r() * 28 + 1)).padStart(2, '0'), 12, y);
      x.fillText(['Ballast', 'Ref. 7', 'Cal.', 'Halde', 'Stock', 'Vault', 'Bell'][Math.floor(r() * 7)] + ' ' + Math.floor(r() * 900), 46, y);
      const v = Math.floor(r() * 40) - 8;
      x.fillStyle = v < 0 ? 'rgba(150,30,25,0.9)' : 'rgba(30,30,45,0.85)';
      x.fillText(String(v), 186, y);
      x.fillStyle = 'rgba(30,30,45,0.85)';
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this._ledgerTex = t;
    return t;
  }
}

function surfaceOf(mat) {
  const n = typeof mat === 'string' ? mat : (mat?.name || '');
  if (/steel|paint|grating|rust|brass|copper/.test(n)) return 'metal';
  if (/plank|veneer|wood/.test(n)) return 'wood';
  if (/rubber|lino/.test(n)) return 'rubber';
  if (/mud/.test(n)) return 'mud';
  return 'stone';
}

// Split a rectangle into solid rectangles around holes. Returns [a0,a1,b0,b1] list.
function splitRect(a0, a1, b0, b1, holes) {
  if (!holes.length) return [[a0, a1, b0, b1]];
  return splitWall(a0, a1, b0, b1, holes.map(h => [h[0], h[2], h[1], h[3]]));
}

function reprojectUV(g, scale) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z * Math.sign(nor.getX(i) || 1); v = y; } else { u = -x * Math.sign(nor.getZ(i) || 1); v = y; }
    uv.setXY(i, u * scale, v * scale);
  }
}

export { norm, cond };
