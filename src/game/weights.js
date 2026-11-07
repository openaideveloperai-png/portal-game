// Weighted objects and load sensing.
//
// A measure is a unit of pull. Bodies keep a constant inertial mass; their gravity
// scale is weight/2, so a 2-measure crate falls normally, 1 falls gently, 0 hangs,
// and negative weight (debt) falls upward. Loads on plates/lifts are computed from the
// contact graph (what rests on what), so stacks, riders and carried objects all count.
import * as THREE from 'three';
import { R, GROUPS } from '../core/physics.js';
import { drumTexture, drumOffset, signTexture } from '../render/signs.js';
import { boxGeom, prepGeom, tmpMatrix } from '../render/geometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { audio } from '../core/audio.js';
import { damp } from '../core/util.js';
import { UNIT_MASS } from './player.js';

const _v = new THREE.Vector3();

export class Weighted {
  constructor(level, opts = {}) {
    this.level = level;
    this.game = level.game;
    this.weighted = true;
    this.weight = opts.weight ?? 2;
    this.initialWeight = this.weight;
    this.min = opts.min ?? -6;
    this.max = opts.max ?? 9;
    this.fixed = !!opts.fixed;
    this.carriable = opts.carriable ?? true;
    this.name = opts.name || 'object';
    this.drums = [];
    this.held = false;
    this.shake = 0;
    this.listeners = [];
    this.kind = 'weighted';
  }

  get label() { return this.name; }
  canCarry() { return this.carriable && !!this.body && !this.fixed && this.weight <= 2; }

  setWeight(w, { silent = false } = {}) {
    const old = this.weight;
    this.weight = w;
    for (const d of this.drums) d.set(w);
    this.applyGravity();
    if (!silent) this.shake = 0.35;
    for (const fn of this.listeners) fn(w, old);
  }
  onChange(fn) { this.listeners.push(fn); }

  applyGravity() {
    if (!this.body || this.fixed) return;
    const w = this.weight;
    this.body.setGravityScale(this.held ? 0 : w / 2, true);
    this.body.setLinearDamping(this.held ? 4 : (w === 0 ? 0.35 : 0.06));
    this.body.setAngularDamping(this.held ? 8 : (w === 0 ? 0.8 : 0.45));
    this.body.wakeUp();
  }

  position(out = new THREE.Vector3()) {
    if (this.body) { const t = this.body.translation(); return out.set(t.x, t.y, t.z); }
    return out.copy(this.object.position);
  }

  updateDrums(dt) { for (const d of this.drums) d.update(dt); }
  update(dt) { this.updateDrums(dt); }
  fixedUpdate() {}
  reset() {}
  dispose() {}
}

// A framed numeral window. The drum strip scrolls to the current value.
export class Drum {
  constructor(size = 0.16) {
    const { texture, cells } = drumTexture();
    this.cells = cells;
    this.tex = texture.clone();
    this.tex.repeat.set(1, 1.15 / cells);
    this.tex.needsUpdate = true;
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.38, metalness: 0, envMapIntensity: 0.6 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.15), this.mat);
    this.cur = null; this.target = 0; this.value = 0;
  }
  set(v) { this.value = v; this.target = drumOffset(v, 1.15); if (this.cur === null) { this.cur = this.target; this.tex.offset.y = this.cur; } }
  update(dt) {
    if (this.cur === null) return;
    const before = this.cur;
    this.cur = damp(this.cur, this.target, 9, dt);
    if (Math.abs(this.cur - this.target) < 1e-4) this.cur = this.target;
    if (before !== this.cur) this.tex.offset.y = this.cur;
  }
  dispose() { this.tex.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); }
}

// Shared crate geometry, built once per size.
const crateGeoCache = new Map();
function crateGeometry(s) {
  if (crateGeoCache.has(s)) return crateGeoCache.get(s);
  const h = s / 2;
  const wood = [];
  // six slightly inset panels with a chamfered core
  wood.push(boxGeom([-h + 0.012, -h + 0.012, -h + 0.012], [h - 0.012, h - 0.012, h - 0.012], { bevel: 0.01, grime: false }));
  // vertical boards on each side face (raised planks give relief)
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z0 = -h + 0.06 + i * (s - 0.12) / 3, z1 = z0 + (s - 0.12) / 3 - 0.012;
    wood.push(boxGeom([sx * h - (sx > 0 ? 0.016 : 0), -h + 0.06, z0], [sx * h + (sx > 0 ? 0 : 0.016), h - 0.06, z1], { bevel: 0.004, grime: false }));
    wood.push(boxGeom([z0, -h + 0.06, sx * h - (sx > 0 ? 0.016 : 0)], [z1, h - 0.06, sx * h + (sx > 0 ? 0 : 0.016)], { bevel: 0.004, grime: false }));
  }
  const steel = [];
  // corner caps and two bands
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const c = [x * (h - 0.045), y * (h - 0.045), z * (h - 0.045)];
    steel.push(boxGeom([c[0] - 0.05, c[1] - 0.05, c[2] - 0.05], [c[0] + 0.05, c[1] + 0.05, c[2] + 0.05], { bevel: 0.008, grime: false }));
  }
  for (const y of [-h * 0.62, h * 0.62]) {
    steel.push(boxGeom([-h - 0.006, y - 0.025, -h - 0.006], [h + 0.006, y + 0.025, -h + 0.01], { grime: false }));
    steel.push(boxGeom([-h - 0.006, y - 0.025, h - 0.01], [h + 0.006, y + 0.025, h + 0.006], { grime: false }));
    steel.push(boxGeom([-h - 0.006, y - 0.025, -h], [-h + 0.01, y + 0.025, h], { grime: false }));
    steel.push(boxGeom([h - 0.01, y - 0.025, -h], [h + 0.006, y + 0.025, h], { grime: false }));
  }
  // brass bezels around the numeral windows (4 sides + top)
  const brass = [];
  const bz = 0.105;
  for (let f = 0; f < 5; f++) {
    const ring = [];
    const t = 0.018, d = 0.012;
    ring.push(boxGeom([-bz, bz * 1.15 - t, 0], [bz, bz * 1.15, d], { bevel: 0.003, grime: false }));
    ring.push(boxGeom([-bz, -bz * 1.15, 0], [bz, -bz * 1.15 + t, d], { bevel: 0.003, grime: false }));
    ring.push(boxGeom([-bz, -bz * 1.15, 0], [-bz + t, bz * 1.15, d], { bevel: 0.003, grime: false }));
    ring.push(boxGeom([bz - t, -bz * 1.15, 0], [bz, bz * 1.15, d], { bevel: 0.003, grime: false }));
    const g = mergeGeometries(ring);
    const m = faceMatrix(f, h);
    g.applyMatrix4(m);
    brass.push(g);
  }
  const out = {
    wood: mergeGeometries(wood.map(stripGrime)), steel: mergeGeometries(steel.map(stripGrime)), brass: mergeGeometries(brass.map(stripGrime)),
  };
  for (const k of Object.keys(out)) { localUV(out[k], 1.0); }
  crateGeoCache.set(s, out);
  return out;
}
function stripGrime(g) { if (g.attributes.grimeRange) g.deleteAttribute('grimeRange'); return g; }
function localUV(g, scale) {
  // re-project UVs in local space so the texture rides with the crate
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = pos.getX(i); v = pos.getZ(i); } else if (ax >= az) { u = pos.getZ(i); v = pos.getY(i); } else { u = pos.getX(i); v = pos.getY(i); }
    uv.setXY(i, u * scale + 0.37, v * scale + 0.11);
  }
}
// Face 0..3 = +z, +x, -z, -x side faces; 4 = top
function faceMatrix(f, h) {
  const m = new THREE.Matrix4();
  if (f === 4) { m.makeRotationX(-Math.PI / 2); m.setPosition(0, h + 0.001, 0); return m; }
  const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][f];
  m.makeRotationY(ang);
  const off = new THREE.Vector3(0, 0, h + 0.001).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
  m.setPosition(off.x, 0, off.z);
  return m;
}

// ---------------------------------------------------------------- Ballast crate
export class Crate extends Weighted {
  constructor(level, { pos, weight = 2, size = 0.7, rotY = 0, name = 'ballast crate', min, max, carriable = true, twin = null, tag = null, wood = 'planks_oak' } = {}) {
    super(level, { weight, min, max, name, carriable });
    this.kind = 'crate';
    this.size = size;
    this.spawn = { pos: [...pos], rotY, weight };
    const mats = level.game.engine.materials;
    const geo = crateGeometry(size);
    const g = new THREE.Group();
    const mw = new THREE.Mesh(geo.wood, mats.get(wood)); mw.castShadow = mw.receiveShadow = true; g.add(mw);
    const ms = new THREE.Mesh(geo.steel, mats.get('paint_black')); ms.castShadow = ms.receiveShadow = true; g.add(ms);
    const mb = new THREE.Mesh(geo.brass, mats.get('brass')); mb.castShadow = true; g.add(mb);
    for (let f = 0; f < 5; f++) {
      const d = new Drum(0.17);
      d.mesh.applyMatrix4(faceMatrix(f, size / 2 + 0.0035));
      g.add(d.mesh);
      d.set(weight);
      this.drums.push(d);
    }
    // stencilled marking on the plain faces
    const st = signTexture(tag ? [tag] : ['BALLAST'], { style: 'stencil', fg: '#e8e0c8', w: 512, h: 128, weight: 700 });
    const sm = new THREE.MeshStandardMaterial({ map: st, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const f of [0, 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.7, size * 0.17), sm);
      p.applyMatrix4(faceMatrix(f, size / 2 + 0.004));
      p.position.y -= size * 0.33;
      g.add(p);
    }
    this.object = g;
    level.root.add(g);

    const phys = level.phys;
    this.body = phys.dynamicBody(pos.map((v, i) => i === 1 ? v + size / 2 : v), { linDamp: 0.06, angDamp: 0.45 });
    if (rotY) this.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), true);
    const hs = size / 2 - 0.02;
    const desc = R.ColliderDesc.roundCuboid(hs, hs, hs, 0.02).setFriction(0.75).setRestitution(0.04)
      .setMass(UNIT_MASS).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(1400);
    this.collider = phys.attach(desc, this.body, { kind: 'crate', owner: this, impactSound: true, surface: 'wood', material: 'wood' });
    this.applyGravity();
    if (twin) this.twin = twin;
    this.sync(1);
  }

  sync() {
    const t = this.body.translation(), r = this.body.rotation();
    this.object.position.set(t.x, t.y, t.z);
    this.object.quaternion.set(r.x, r.y, r.z, r.w);
    if (this.shake > 0) {
      const a = this.shake * 0.02;
      this.object.position.x += (Math.random() - 0.5) * a; this.object.position.y += (Math.random() - 0.5) * a; this.object.position.z += (Math.random() - 0.5) * a;
    }
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    this.sync();
    this.updateDrums(dt);
    // keep speed sane; debt crates would otherwise slam the ceiling hard
    const v = this.body.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > 14) this.body.setLinvel({ x: v.x * 14 / sp, y: v.y * 14 / sp, z: v.z * 14 / sp }, true);
  }

  respawn(resetWeight = true) {
    const s = this.spawn;
    this.body.setTranslation({ x: s.pos[0], y: s.pos[1] + this.size / 2 + 0.05, z: s.pos[2] }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY || 0), true);
    if (resetWeight) this.setWeight(s.weight, { silent: true });
  }

  dispose() { for (const d of this.drums) d.dispose(); }
}

// ---------------------------------------------------------------- Anchor weight
// Cast-iron calibration weight bolted to the floor (or to a plate). Can be drawn from
// and given to; never moves.
export class Anchor extends Weighted {
  constructor(level, { pos, weight = 4, rotY = 0, name = 'anchor weight', min = 0, max = 9, size = 1, plate = null } = {}) {
    super(level, { weight, min, max, name, carriable: false });
    this.fixed = true;
    this.kind = 'anchor';
    const mats = level.game.engine.materials;
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    g.rotation.y = rotY;
    // classic bell-shaped cast weight with a lifting knob
    const prof = [];
    const s = size;
    const pts = [[0, 0], [0.34, 0], [0.36, 0.03], [0.35, 0.08], [0.31, 0.42], [0.27, 0.5], [0.16, 0.56], [0.1, 0.58], [0.1, 0.66], [0.13, 0.7], [0.13, 0.76], [0.09, 0.79], [0, 0.8]];
    for (const [x, y] of pts) prof.push(new THREE.Vector2(x * s, y * s));
    const lathe = new THREE.LatheGeometry(prof, 40);
    const iron = new THREE.Mesh(lathe, mats.get('paint_black', { param: 0.65 }));
    iron.castShadow = iron.receiveShadow = true;
    g.add(iron);
    // base plinth with bolts
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.44 * s, 0.05, 40), mats.get('steel_dark'));
    base.position.y = 0.025 - 0.02; base.receiveShadow = true; g.add(base);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.04, 8), mats.get('brass'));
      const a = i * Math.PI / 2 + Math.PI / 4;
      b.position.set(Math.cos(a) * 0.38 * s, 0.035, Math.sin(a) * 0.38 * s); g.add(b);
    }
    for (let f = 0; f < 2; f++) {
      const d = new Drum(0.15 * s);
      const ang = f * Math.PI;
      d.mesh.position.set(Math.sin(ang) * 0.335 * s, 0.24 * s, Math.cos(ang) * 0.335 * s);
      d.mesh.rotation.y = ang;
      d.mesh.rotation.x = -0.1;
      g.add(d.mesh);
      d.set(weight);
      this.drums.push(d);
    }
    this.object = g;
    level.root.add(g);
    const phys = level.phys;
    this.collider = phys.fixedCollider(R.ColliderDesc.cylinder(0.4 * s, 0.33 * s).setTranslation(pos[0], pos[1] + 0.4 * s, pos[2]), { kind: 'static', owner: this, surface: 'metal' });
    this.plate = plate;
    if (plate) plate.anchors.push(this);
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    this.updateDrums(dt);
  }
  position(out = new THREE.Vector3()) { return out.copy(this.object.position).add(_v.set(0, 0.4, 0)); }
  dispose() { for (const d of this.drums) d.dispose(); }
}

// ---------------------------------------------------------------- load sensing
// Sum of weights resting on `collider` (dir=+1), or pushing up against it (dir=-1, for
// ceiling plates). Includes the player (and what they carry) if they stand on the stack.
export function loadOn(level, colliders, { dir = 1 } = {}) {
  const phys = level.phys;
  const game = level.game;
  const cols = [].concat(colliders);
  const seen = new Set();
  const heldBody = game.tare?.held?.body;
  let load = 0;
  const queue = [];
  const sensorHandles = new Set(cols.map(c => c.handle));
  for (const c of cols) phys.contactsOf(c, (other, up) => { if (up * dir > 0.5) queue.push(other); });
  while (queue.length) {
    const c = queue.pop();
    const b = c.parent();
    if (!b || seen.has(b.handle)) continue;
    if (heldBody && b.handle === heldBody.handle) continue;
    const info = phys.infoOf(c);
    if (info?.kind === 'player') continue;
    seen.add(b.handle);
    const o = info?.owner;
    if (o?.weighted) load += dir > 0 ? o.weight : -o.weight;
    const n = b.numColliders();
    for (let i = 0; i < n; i++) phys.contactsOf(b.collider(i), (other, up) => {
      if (up * dir > 0.5 && other.parent() && !seen.has(other.parent().handle) && !sensorHandles.has(other.handle)) queue.push(other);
    });
  }
  const p = game.player;
  const gc = p.groundCollider;
  if (gc && p.grounded) {
    const onSensor = sensorHandles.has(gc.handle) || (gc.parent() && seen.has(gc.parent().handle));
    if (onSensor) {
      const carried = game.tare?.held ? game.tare.held.weight : 0;
      const w = p.weight + carried;
      load += dir > 0 ? w : -w;
    }
  }
  return { load, bodies: seen };
}
