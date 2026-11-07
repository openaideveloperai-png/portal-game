// Puzzle elements. Each has update(dt) (visuals), fixedUpdate(dt) (logic at 60 Hz),
// reset() (back to the chamber's initial state) and an `active` signal where relevant.
import * as THREE from 'three';
import { R, GROUPS } from '../core/physics.js';
import { loadOn, Crate, Weighted, Drum } from './weights.js';
import { dialTexture, signTexture, flapTexture, labelTexture } from '../render/signs.js';
import { boxGeom } from '../render/geometry.js';
import { audio } from '../core/audio.js';
import { damp, clamp, rng, lerp } from '../core/util.js';
import { G, UNIT_MASS } from './player.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const qY = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
const rq = q => ({ x: q.x, y: q.y, z: q.z, w: q.w });

export function cond(spec) {
  if (spec === undefined || spec === null) return () => false;
  if (spec === true) return () => true;
  if (typeof spec === 'function') return spec;
  if (Array.isArray(spec)) { const fs = spec.map(cond); return () => fs.every(f => f()); }
  if (spec.any) { const fs = spec.any.map(cond); return () => fs.some(f => f()); }
  if (spec.not) { const f = cond(spec.not); return () => !f(); }
  return () => !!spec.active;
}

class Element {
  constructor(L) { this.L = L; this.game = L.game; L.entities.push(this); }
  get mats() { return this.game.engine.materials; }
  update() {}
  fixedUpdate() {}
  reset() {}
  dispose() {}
}

// ---------------------------------------------------------------- dial (shared)
export class Dial {
  constructor(L, { pos, rotY = 0, tilt = -0.35, min = 0, max = 8, need = null, exact = false, label = 'MEASURES', r = 0.15, post = 1.05, lamp = true }) {
    this.L = L;
    const mats = L.game.engine.materials;
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    g.rotation.y = rotY;
    if (post > 0) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, post, 12), mats.get('paint_black'));
      p.position.y = post / 2; p.castShadow = true; g.add(p);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 16), mats.get('paint_black'));
      foot.position.y = 0.02; g.add(foot);
    }
    const head = new THREE.Group();
    head.position.y = post + r * 0.6;
    head.rotation.x = tilt;
    g.add(head);
    const { texture, angle } = dialTexture({ min, max, need, exact, label });
    this.angle = angle;
    const face = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45 }));
    face.position.z = 0.012; head.add(face);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.12, 0.07, 40), mats.get('brass'));
    body.rotation.x = Math.PI / 2; body.position.z = -0.025; body.castShadow = true; head.add(body);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, 0.012, 8, 40), mats.get('brass'));
    bezel.position.z = 0.016; head.add(bezel);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 1.02, 40), mats.glass({ opacity: 0.1 }));
    glass.position.z = 0.03; head.add(glass);
    this.needle = new THREE.Group(); this.needle.position.z = 0.02; head.add(this.needle);
    const nd = new THREE.Mesh(new THREE.BoxGeometry(0.008, r * 0.86, 0.004), mats.plain('#8f241a', { rough: 0.5 }));
    nd.position.y = r * 0.38; this.needle.add(nd);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12), mats.get('brass'));
    hub.rotation.x = Math.PI / 2; this.needle.add(hub);
    if (lamp) {
      this.lampOn = mats.emissive('#ffcf8a', 3.2);
      this.lampOff = mats.plain('#4a3b2c', { rough: 0.3 });
      this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), this.lampOff);
      this.lamp.position.set(0, r * 1.25, 0); head.add(this.lamp);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 12), mats.get('brass'));
      cap.position.set(0, r * 1.2, 0); head.add(cap);
    }
    this.head = head;
    this.object = g;
    this.value = 0; this.shown = 0; this.vel = 0;
    L.root.add(g);
    this.min = min; this.max = max;
  }
  set(v, lit) { this.value = clamp(v, this.min - 0.4, this.max + 0.4); if (this.lamp) this.lamp.material = lit ? this.lampOn : this.lampOff; }
  update(dt) {
    // slightly underdamped needle so it settles like a real movement
    const k = 60, c = 9;
    const a = (this.value - this.shown) * k - this.vel * c;
    this.vel += a * dt; this.shown += this.vel * dt;
    this.needle.rotation.z = this.angle(this.shown);
  }
}

// ---------------------------------------------------------------- weighing plate
export class Plate extends Element {
  constructor(L, { pos, need = 2, exact = false, size = 1.0, dial = true, dialAt = null, dialRotY = null, ceiling = false, name = null }) {
    super(L);
    this.kind = 'plate';
    this.need = need; this.exact = exact; this.ceiling = ceiling;
    this.pos = pos; this.size = size;
    this.anchors = [];
    this.pressed = false; this.load = 0; this.pend = 0;
    const s = size / 2;
    const dir = ceiling ? -1 : 1;
    // frame (in the batch) and the moving top
    const fy = pos[1];
    const t = 0.05;
    L.visual([pos[0] - s - 0.06, fy, pos[2] - s - 0.06], [pos[0] + s + 0.06, fy + 0.02 * dir, pos[2] + s + 0.06].map((v, i) => v), 'steel_dark', { grime: false, flipY: ceiling });
    this.top = new THREE.Mesh(new THREE.BoxGeometry(size, 0.04, size), this.mats.get('rubber'));
    this.topY = fy + (ceiling ? -0.02 : 0.02) + 0.02 * dir * 0;
    this.top.position.set(pos[0], fy + dir * 0.03, pos[2]);
    this.top.receiveShadow = true; this.top.castShadow = true;
    L.root.add(this.top);
    // brass corner studs
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 10), this.mats.get('brass'));
      m.position.set(pos[0] + x * (s + 0.03), fy + dir * 0.025, pos[2] + z * (s + 0.03)); L.root.add(m);
    }
    this.collider = L.phys.fixedBox([pos[0], fy + dir * 0.025, pos[2]], [s, 0.025, s], { info: { kind: 'static', surface: 'rubber', owner: this } });
    if (dial) {
      const at = dialAt || [pos[0] + s + 0.35, ceiling ? fy - 1.6 : fy, pos[2]];
      const ry = dialRotY ?? Math.atan2(L.focus ? L.focus[0] - at[0] : 0, L.focus ? L.focus[2] - at[2] : 1);
      this.dial = new Dial(L, { pos: at, rotY: ry, min: Math.min(0, need - 4), max: Math.max(6, need + 2), need, exact, post: ceiling ? 0 : 1.0, tilt: ceiling ? 0.3 : -0.35 });
      if (ceiling) this.dial.object.rotation.x = Math.PI;
    }
    if (name) L.named[name] = this;
  }
  get active() { return this.pressed; }
  fixedUpdate(dt) {
    const { load } = loadOn(this.L, this.collider, { dir: this.ceiling ? -1 : 1 });
    let total = load;
    for (const a of this.anchors) total += a.weight;
    this.load = total;
    const want = this.exact ? total === this.need : total >= this.need;
    if (want !== this.pressed) {
      this.pend += dt;
      if (this.pend > 0.12) {
        this.pressed = want; this.pend = 0;
        audio.play('plate', { down: want, pos: V(...this.pos) });
        this.L.onSignal?.(this);
      }
    } else this.pend = 0;
  }
  update(dt) {
    const dir = this.ceiling ? -1 : 1;
    const sink = clamp(this.load * 0.004, -0.012, 0.016) * dir;
    const y = this.pos[1] + dir * 0.03 - sink;
    this.top.position.y = damp(this.top.position.y, y, 12, dt);
    if (this.dial) { this.dial.set(this.load, this.pressed); this.dial.update(dt); }
  }
  reset() { this.pressed = false; this.load = 0; }
}

// ---------------------------------------------------------------- door
export class Door extends Element {
  constructor(L, { pos, rotY = 0, w = 1.6, h = 2.5, when = null, mat = 'paint_green', speed = 1.3, open = false, style = 'slide', sign = true, name = null, latch = false }) {
    super(L);
    this.kind = 'door';
    this.cond = cond(when);
    this.pos = pos; this.rotY = rotY; this.w = w; this.h = h;
    this.open = open ? 1 : 0; this.target = this.open; this.speed = speed; this.style = style;
    this.latch = latch; this.latched = false;
    const q = qY(rotY);
    this.leaves = [];
    const n = style === 'slide' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const lw = style === 'slide' ? w / 2 : w;
      const leaf = new THREE.Group();
      const panel = new THREE.Mesh(boxGeom([-lw / 2, 0, -0.04], [lw / 2, h, 0.04], { bevel: 0.01, grime: [0, h] }), this.mats.get(mat));
      panel.castShadow = panel.receiveShadow = true;
      leaf.add(panel);
      // vision slot + kick plate + handle rails
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.09), this.mats.glass({ opacity: 0.35, tint: '#2a3330' }));
      slot.position.set((style === 'slide' ? (i === 0 ? 1 : -1) : 0) * lw * 0.25, 1.55, 0); leaf.add(slot);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.06, 0.22, 0.09), this.mats.get('steel'));
      kick.position.set(0, 0.13, 0); leaf.add(kick);
      for (const zs of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.1, 0.03, 0.02), this.mats.get('steel_dark'));
        bar.position.set(0, 1.05, zs * 0.05); leaf.add(bar);
      }
      L.root.add(leaf);
      const body = L.phys.kinematicBody(pos, rq(q));
      L.phys.attach(R.ColliderDesc.cuboid(lw / 2, h / 2, 0.06).setTranslation(0, h / 2, 0), body, { kind: 'static', surface: 'metal', owner: this }, GROUPS.static);
      this.leaves.push({ leaf, body, lw, side: style === 'slide' ? (i === 0 ? -1 : 1) : 0 });
    }
    // frame
    const f = 0.12;
    L.visualLocal(pos, rotY, [-w / 2 - f, 0, -0.16], [-w / 2, h + f, 0.16], 'steel_dark', { bevel: 0.01 });
    L.visualLocal(pos, rotY, [w / 2, 0, -0.16], [w / 2 + f, h + f, 0.16], 'steel_dark', { bevel: 0.01 });
    L.visualLocal(pos, rotY, [-w / 2, h, -0.16], [w / 2, h + f, 0.16], 'steel_dark', { bevel: 0.01 });
    if (sign) {
      // mechanical flip sign: a little enamel vane that turns between SHUT and OPEN
      const sg = new THREE.Group();
      const p = V(0, h + 0.35, 0.2).applyAxisAngle(UP, rotY).add(V(...pos));
      sg.position.copy(p); sg.rotation.y = rotY;
      const shut = signTexture(['SHUT'], { bg: '#7d2a1f', fg: '#efe5cd', w: 256, h: 96 });
      const opn = signTexture(['OPEN'], { bg: '#e6dcc2', fg: '#2a2622', w: 256, h: 96 });
      const vane = new THREE.Group();
      const a = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: shut, roughness: 0.35 }));
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: opn, roughness: 0.35 }));
      a.position.z = 0.004; b.position.z = -0.004; b.rotation.x = Math.PI;
      vane.add(a, b);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.06), this.mats.get('paint_black'));
      housing.position.z = -0.04;
      sg.add(housing, vane);
      L.root.add(sg);
      // back side (other face of the wall)
      const sg2 = sg.clone(); sg2.rotation.y = rotY + Math.PI;
      const p2 = V(0, h + 0.35, -0.2).applyAxisAngle(UP, rotY).add(V(...pos)); sg2.position.copy(p2);
      L.root.add(sg2);
      this.vanes = [vane, sg2.children[1]];
    }
    this.sync();
    if (name) L.named[name] = this;
  }
  get active() { return this.open > 0.95; }
  blocked() {
    // don't close on the player
    const p = this.game.player.pos;
    const local = p.clone().sub(V(...this.pos)).applyAxisAngle(UP, -this.rotY);
    return Math.abs(local.x) < this.w / 2 + 0.3 && Math.abs(local.z) < 0.55 && local.y > -1 && local.y < this.h + 1;
  }
  fixedUpdate(dt) {
    let want = this.cond() ? 1 : 0;
    if (this.latch && want) this.latched = true;
    if (this.latched) want = 1;
    if (this.forced !== undefined) want = this.forced;
    if (want === 0 && this.target === 1 && this.blocked()) want = 1;
    if (want !== this.target) {
      this.target = want;
      audio.play('relay', { pos: V(...this.pos) });
      this.motor?.stop(0.2);
      this.motor = audio.loop('motor', { pos: V(this.pos[0], this.pos[1] + 1.5, this.pos[2]), gain: 0.5 });
    }
    const before = this.open;
    this.open = clamp(this.open + Math.sign(this.target - this.open) * dt * this.speed, 0, 1);
    if (before !== this.open && (this.open === 0 || this.open === 1)) {
      this.motor?.stop(0.15); this.motor = null;
      audio.play('clank', { pos: V(this.pos[0], this.pos[1] + 1.2, this.pos[2]), gain: 0.6 });
    }
    this.sync();
  }
  sync() {
    const e = this.open < 0.5 ? 2 * this.open * this.open : 1 - Math.pow(-2 * this.open + 2, 2) / 2;
    const q = qY(this.rotY);
    for (const l of this.leaves) {
      let off;
      if (this.style === 'slide') off = V(l.side * (l.lw / 2 + e * (l.lw - 0.04)), 0, 0);
      else off = V(0, e * (this.h - 0.15), 0);
      off.applyAxisAngle(UP, this.rotY).add(V(...this.pos));
      l.body.setNextKinematicTranslation({ x: off.x, y: off.y, z: off.z });
      l.leaf.position.copy(off); l.leaf.quaternion.copy(q);
    }
    if (this.vanes) for (const v of this.vanes) v.rotation.x = damp(v.rotation.x, this.open > 0.5 ? Math.PI : 0, 10, 1 / 60);
  }
  reset() { this.open = 0; this.target = 0; this.latched = false; this.forced = undefined; this.sync(); }
  dispose() { this.motor?.stop(0.1); }
}

// ---------------------------------------------------------------- signal conduit
export class Wire extends Element {
  constructor(L, { from, points, y = null, spacing = 0.7 }) {
    super(L);
    this.src = cond(from);
    const pts = points.map(p => p.length === 2 ? V(p[0], y ?? 0, p[1]) : V(...p));
    this.lamps = [];
    this.onMat = this.mats.emissive('#ffcb7a', 2.6);
    this.offMat = this.mats.plain('#3a332b', { rough: 0.25 });
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 1e-3) continue;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a).normalize();
      const vertical = Math.abs(dir.y) > 0.7;
      const g = vertical ? new THREE.BoxGeometry(0.05, len + 0.05, 0.03) : new THREE.BoxGeometry(0.05, 0.025, len + 0.05);
      const m = new THREE.Mesh(g, this.mats.get('paint_ochre'));
      m.position.copy(mid);
      if (!vertical) m.rotation.y = Math.atan2(dir.x, dir.z);
      m.position.y += vertical ? 0 : 0.015;
      m.receiveShadow = true;
      L.root.add(m);
      for (let d = (spacing - (dist % spacing)); d < len; d += spacing) {
        const p = a.clone().addScaledVector(dir, d);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.offMat);
        lamp.position.copy(p);
        if (vertical) { lamp.rotation.x = Math.PI / 2; lamp.position.add(V(0, 0, 0.018)); } else lamp.position.y += 0.03;
        L.root.add(lamp);
        this.lamps.push({ mesh: lamp, at: dist + d });
      }
      dist += len;
    }
    this.total = dist;
    this.front = 0;
  }
  update(dt) {
    const on = this.src();
    this.front = clamp(this.front + (on ? 1 : -1) * dt * 9, 0, this.total + 0.5);
    for (const l of this.lamps) {
      const lit = l.at <= this.front;
      const m = lit ? this.onMat : this.offMat;
      if (l.mesh.material !== m) l.mesh.material = m;
    }
  }
}

// ---------------------------------------------------------------- counterweight lift
export class Lift extends Element {
  constructor(L, { a, b, size = [2, 2], range = [-4, 4], start = 0, selfA = 0, selfB = 0, pulleyY = null, gain = 0.8, maxV = 1.4, railsA = 'xz', railsB = 'xz', mat = 'paint_ochre', cageA = true, cageB = true, ballast = null, ballastSide = [1, -1], roof = [false, false], name = null }) {
    super(L);
    this.kind = 'lift';
    this.a0 = V(...a); this.b0 = V(...b);
    this.size = size; this.range = range;
    this.s = start; this.v = 0;
    this.selfA = selfA; this.selfB = selfB;
    this.gain = gain; this.maxV = maxV;
    this.initial = start;
    this.pulleyY = pulleyY ?? Math.max(a[1], b[1]) + range[1] + 3.5;
    this.plats = [this.makePlat(this.a0, railsA, mat, cageA, roof[0]), this.makePlat(this.b0, railsB, mat, cageB, roof[1])];
    // overhead beam with two sheaves and the rope
    const mid = this.a0.clone().add(this.b0).multiplyScalar(0.5);
    const span = this.a0.distanceTo(this.b0);
    const ang = Math.atan2(this.b0.x - this.a0.x, this.b0.z - this.a0.z);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, span + 0.8), this.mats.get('paint_black'));
    beam.position.set(mid.x, this.pulleyY + 0.45, mid.z); beam.rotation.y = ang; beam.castShadow = true;
    L.root.add(beam);
    this.sheaves = [];
    for (const p of [this.a0, this.b0]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 28), this.mats.get('paint_black'));
      wheel.position.set(p.x, this.pulleyY, p.z); wheel.rotation.y = ang + Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), this.mats.get('brass'));
      hub.rotation.x = Math.PI / 2; wheel.add(hub);
      for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.03), this.mats.get('paint_black')); sp.rotation.z = i * Math.PI / 4; wheel.add(sp); }
      L.root.add(wheel);
      this.sheaves.push(wheel);
    }
    const ropeMat = this.mats.get('steel_dark');
    this.ropes = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), ropeMat); L.root.add(m); return m; });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, span, 6), ropeMat);
    top.position.set(mid.x, this.pulleyY + 0.33, mid.z); top.rotation.x = Math.PI / 2; top.rotation.y = ang;
    L.root.add(top);
    this.loadA = 0; this.loadB = 0;
    this.hum = null;
    this.ballast = [];
    if (ballast) ballast.forEach((w, i) => { if (w !== null && w !== undefined) this.ballast[i] = new LiftBallast(L, this, i, w, ballastSide[i]); });
    this.sync(true);
  }
  makePlat(p0, rails, mat, cage, roof = false) {
    const [w, d] = this.size;
    const g = new THREE.Group();
    const floor = new THREE.Mesh(boxGeom([-w / 2, -0.1, -d / 2], [w / 2, 0, d / 2], { bevel: 0.01, grime: false }), this.mats.get('steel_dark'));
    floor.receiveShadow = floor.castShadow = true; g.add(floor);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.01, d - 0.1), this.mats.get('rubber'));
    deck.position.y = 0.005; deck.receiveShadow = true; g.add(deck);
    const body = this.L.phys.kinematicBody([p0.x, p0.y, p0.z]);
    const col = this.L.phys.attach(R.ColliderDesc.cuboid(w / 2, 0.05, d / 2).setTranslation(0, -0.05, 0), body, { kind: 'lift', surface: 'metal', owner: this }, GROUPS.static);
    if (cage) {
      // posts + rail on three sides (open on the side facing +z local)
      const H = 1.05;
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H, 8), this.mats.get(mat));
        post.position.set(x, H / 2, z); post.castShadow = true; g.add(post);
      }
      const railSides = [];
      if (rails.includes('x')) railSides.push([[-w / 2, -d / 2], [-w / 2, d / 2]], [[w / 2, -d / 2], [w / 2, d / 2]]);
      if (rails.includes('z')) railSides.push([[-w / 2, -d / 2], [w / 2, -d / 2]]);
      if (rails.includes('Z')) railSides.push([[-w / 2, d / 2], [w / 2, d / 2]]);
      for (const [[x0, z0], [x1, z1]] of railSides) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        for (const y of [H, H * 0.5]) {
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), this.mats.get(mat));
          r.rotation.x = Math.PI / 2; r.rotation.y = Math.atan2(x1 - x0, z1 - z0);
          r.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); g.add(r);
        }
        this.L.phys.attach(R.ColliderDesc.cuboid(Math.abs(x1 - x0) / 2 + 0.03, 0.35, Math.abs(z1 - z0) / 2 + 0.03).setTranslation((x0 + x1) / 2, 0.35, (z0 + z1) / 2), body, { kind: 'lift', surface: 'metal', owner: this }, GROUPS.rail);
      }
      // hanger bars to the rope
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), this.mats.get('paint_black'));
      bar.position.y = 2.3; g.add(bar);
      for (const x of [-w / 2, w / 2]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.3, 6), this.mats.get('steel_dark')); s.position.set(x, 1.15, 0); g.add(s); }
    }
    let roofCol = null;
    if (roof) {
      // a grated roof: debt pressing up on it makes the cage lighter
      const rm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), this.mats.get('grating'));
      rm.position.y = 2.32; g.add(rm);
      roofCol = this.L.phys.attach(R.ColliderDesc.cuboid(w / 2, 0.03, d / 2).setTranslation(0, 2.32, 0), body, { kind: 'lift', surface: 'metal', owner: this }, GROUPS.static);
    }
    this.L.root.add(g);
    return { g, body, col, p0, roofCol };
  }
  positions() {
    return [this.a0.y - this.s, this.b0.y + this.s];
  }
  fixedUpdate(dt) {
    const roofP = pl => (pl.roofCol ? loadOn(this.L, pl.roofCol, { dir: -1 }).load : 0);
    this.loadA = loadOn(this.L, this.plats[0].col).load - roofP(this.plats[0]) + this.selfA + (this.ballast[0]?.weight || 0);
    this.loadB = loadOn(this.L, this.plats[1].col).load - roofP(this.plats[1]) + this.selfB + (this.ballast[1]?.weight || 0);
    const net = this.loadA - this.loadB;
    let target = clamp(net * this.gain, -this.maxV, this.maxV);
    if (this.locked) target = 0;
    const acc = 2.2;
    this.v += clamp(target - this.v, -acc * dt, acc * dt);
    let ns = this.s + this.v * dt;
    if (ns < this.range[0]) { ns = this.range[0]; if (this.v < -0.3) audio.play('clank', { pos: this.plats[1].g.position, gain: 0.5 }); this.v = 0; }
    if (ns > this.range[1]) { ns = this.range[1]; if (this.v > 0.3) audio.play('clank', { pos: this.plats[0].g.position, gain: 0.5 }); this.v = 0; }
    this.s = ns;
    const moving = Math.abs(this.v) > 0.05;
    if (moving && !this.hum) this.hum = audio.loop('chain', { pos: this.plats[0].g.position.clone(), gain: 0.35 });
    if (!moving && this.hum) { this.hum.stop(0.3); this.hum = null; }
    this.sync();
  }
  sync(instant = false) {
    const [ya, yb] = this.positions();
    const pa = this.plats[0], pb = this.plats[1];
    pa.body.setNextKinematicTranslation({ x: this.a0.x, y: ya, z: this.a0.z });
    pb.body.setNextKinematicTranslation({ x: this.b0.x, y: yb, z: this.b0.z });
    if (instant) { pa.body.setTranslation({ x: this.a0.x, y: ya, z: this.a0.z }, true); pb.body.setTranslation({ x: this.b0.x, y: yb, z: this.b0.z }, true); }
  }
  update(dt) {
    const [ya, yb] = this.positions();
    this.plats[0].g.position.set(this.a0.x, ya, this.a0.z);
    this.plats[1].g.position.set(this.b0.x, yb, this.b0.z);
    for (let i = 0; i < 2; i++) {
      const y = i === 0 ? ya : yb; const p = i === 0 ? this.a0 : this.b0;
      const top = this.pulleyY, bot = y + 2.3;
      const r = this.ropes[i];
      r.scale.y = Math.max(0.01, top - bot);
      r.position.set(p.x, (top + bot) / 2, p.z);
      this.sheaves[i].rotation.x = 0;
      this.sheaves[i].children.forEach(() => {});
    }
    this.sheaves.forEach((s, i) => s.rotateOnAxis(V(0, 0, 1), (i ? -1 : 1) * this.v * dt / 0.32));
    if (this.hum) this.hum.setPos(this.plats[0].g.position);
  }
  reset() { this.s = this.initial; this.v = 0; this.sync(true); }
  dispose() { this.hum?.stop(0.1); }
}

// ---------------------------------------------------------------- updraft vent
export class Vent extends Element {
  constructor(L, { pos, size = [1.4, 1.4], height = 6, strength = 1.5, on = true }) {
    super(L);
    this.kind = 'vent';
    this.pos = V(...pos); this.size = size; this.height = height; this.strength = strength;
    this.cond = typeof on === 'boolean' ? () => on : cond(on);
    const [w, d] = size;
    // well + grille + fan
    L.visual([pos[0] - w / 2 - 0.08, pos[1] - 0.02, pos[2] - d / 2 - 0.08], [pos[0] + w / 2 + 0.08, pos[1] + 0.03, pos[2] + d / 2 + 0.08], 'steel_dark', { grime: false });
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mats.get('grating'));
    grille.rotation.x = -Math.PI / 2; grille.position.set(pos[0], pos[1] + 0.035, pos[2]); grille.receiveShadow = true;
    L.root.add(grille);
    this.fan = new THREE.Group(); this.fan.position.set(pos[0], pos[1] - 0.35, pos[2]);
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, d) * 0.45, 0.01, 0.16), this.mats.get('paint_black'));
      blade.position.x = Math.min(w, d) * 0.22; blade.rotation.x = 0.4;
      const arm = new THREE.Group(); arm.rotation.y = i / 5 * Math.PI * 2; arm.add(blade); this.fan.add(arm);
    }
    L.root.add(this.fan);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), this.mats.plain('#0d0c0b', { rough: 1, side: THREE.BackSide }));
    pit.position.set(pos[0], pos[1] - 0.3, pos[2]); L.root.add(pit);
    // cloth streamers tied to the grille: the most legible "air is moving" signal
    this.streamers = [];
    const r = rng(Math.floor(pos[0] * 13 + pos[2] * 7));
    const cols = ['#a3281c', '#e6dcc2', '#a3281c', '#e6dcc2'];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.PlaneGeometry(0.06, 0.7, 1, 8); g.translate(0, 0.35, 0);
      const m = new THREE.Mesh(g, this.mats.plain(cols[i], { rough: 0.9, side: THREE.DoubleSide }));
      const cx = (i % 2 ? 1 : -1) * (w / 2 - 0.05), cz = (i < 2 ? 1 : -1) * (d / 2 - 0.05);
      m.position.set(pos[0] + cx, pos[1] + 0.04, pos[2] + cz);
      m.rotation.y = r() * Math.PI;
      L.root.add(m);
      this.streamers.push({ m, base: g.attributes.position.array.slice(), ph: r() * 6 });
    }
    // dust motes
    const N = 160;
    const pg = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    this.motes = [];
    for (let i = 0; i < N; i++) { const m = { x: (r() - 0.5) * w, y: r() * height, z: (r() - 0.5) * d, s: 0.6 + r() }; this.motes.push(m); }
    pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#d8ccb0', size: 0.018, transparent: true, opacity: 0.55, depthWrite: false }));
    this.points.position.copy(this.pos);
    this.points.frustumCulled = false;
    L.root.add(this.points);
    this.t = 0;
    this.snd = null;
  }
  get active() { return this.cond(); }
  falloff(y) {
    const h = y - this.pos.y;
    if (h < 0 || h > this.height) return 0;
    return h < this.height - 1.2 ? 1 : (this.height - h) / 1.2;
  }
  fixedUpdate(dt) {
    const on = this.cond();
    if (on && !this.snd) this.snd = audio.loop('vent', { pos: this.pos.clone().add(V(0, 0.5, 0)), gain: 0.4 });
    if (!on && this.snd) { this.snd.stop(0.6); this.snd = null; }
    if (!on) return;
    const [w, d] = this.size;
    const c = [this.pos.x, this.pos.y + this.height / 2, this.pos.z];
    const cols = this.L.phys.overlapBox(c, [w / 2, this.height / 2, d / 2], GROUPS.aim);
    const seen = new Set();
    for (const col of cols) {
      const b = col.parent();
      if (!b || !b.isDynamic() || seen.has(b.handle)) continue;
      seen.add(b.handle);
      const t = b.translation();
      const f = this.falloff(t.y);
      if (f <= 0) continue;
      const m = b.mass();
      const lv = b.linvel();
      // lift + gentle centring + vertical damping
      const ay = (G / 2) * this.strength * f;
      b.applyImpulse({ x: (this.pos.x - t.x) * 2 * m * dt - lv.x * 0.6 * m * dt, y: (ay - lv.y * 0.8) * m * dt, z: (this.pos.z - t.z) * 2 * m * dt - lv.z * 0.6 * m * dt }, true);
    }
    const p = this.game.player;
    const pp = p.pos;
    if (Math.abs(pp.x - this.pos.x) < w / 2 && Math.abs(pp.z - this.pos.z) < d / 2) {
      const f = this.falloff(pp.y - 0.9);
      if (f > 0) {
        p.extAccel.y += (G / 2) * this.strength * f - p.vel.y * 0.8;
        p.inVent = true;
      }
    }
  }
  update(dt) {
    const on = this.cond();
    this.t += dt;
    this.fan.rotation.y += dt * (on ? 14 : 0);
    for (const s of this.streamers) {
      const a = s.m.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const y0 = s.base[i * 3 + 1];
        const k = y0 / 0.7;
        const wob = on ? Math.sin(this.t * 13 + s.ph + y0 * 9) * 0.05 * k : 0;
        a.setX(i, s.base[i * 3] + wob);
        a.setY(i, on ? y0 : y0 * 0.1);
        a.setZ(i, on ? Math.sin(this.t * 7 + s.ph + y0 * 5) * 0.04 * k : y0 * 0.95);
      }
      a.needsUpdate = true;
    }
    const arr = this.points.geometry.attributes.position.array;
    this.motes.forEach((m, i) => {
      if (on) { m.y += dt * 1.6 * m.s; if (m.y > this.height) m.y = 0; m.x += Math.sin(this.t * 2 + i) * dt * 0.1; }
      arr[i * 3] = m.x; arr[i * 3 + 1] = m.y; arr[i * 3 + 2] = m.z;
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.visible = on;
  }
  dispose() { this.snd?.stop(0.1); }
}

// ---------------------------------------------------------------- wired-glass floor
export class Glass extends Element {
  constructor(L, { min, max, limit = 4 }) {
    super(L);
    this.kind = 'glass';
    this.min = min; this.max = max; this.limit = limit;
    this.strain = 0; this.broken = false; this.cracks = 0;
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const h = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    this.c = c; this.h = h;
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2), this.mats.get('wiredglass'));
    this.mesh.position.set(...c); this.mesh.renderOrder = 2;
    L.root.add(this.mesh);
    this.crackTex = this.makeCrackTexture();
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(h[0] * 2, h[2] * 2), new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, opacity: 0, depthWrite: false }));
    this.crack.rotation.x = -Math.PI / 2; this.crack.position.set(c[0], max[1] + 0.002, c[2]); this.crack.renderOrder = 3;
    L.root.add(this.crack);
    // frame + stamped limit plate
    const fr = 0.06;
    L.visual([min[0] - fr, min[1] - 0.02, min[2] - fr], [max[0] + fr, min[1], max[2] + fr], 'steel_dark', { grime: false });
    for (const [a, b] of [[[min[0] - fr, min[1], min[2] - fr], [max[0] + fr, max[1] + 0.01, min[2]]], [[min[0] - fr, min[1], max[2]], [max[0] + fr, max[1] + 0.01, max[2] + fr]], [[min[0] - fr, min[1], min[2]], [min[0], max[1] + 0.01, max[2]]], [[max[0], min[1], min[2]], [max[0] + fr, max[1] + 0.01, max[2]]]]) L.solid(a, b, 'steel_dark', { grime: false, surface: 'metal' });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.07), new THREE.MeshStandardMaterial({ map: signTexture([`MAX ${limit}`], { style: 'plate', bg: '#b89a5a', fg: '#2a2218', w: 256, h: 80 }), metalness: 0.7, roughness: 0.35 }));
    tag.rotation.x = -Math.PI / 2; tag.position.set(c[0], max[1] + 0.012, max[2] + fr * 0.5); L.root.add(tag);
    this.collider = L.phys.fixedBox(c, h, { info: { kind: 'static', surface: 'metal', owner: this, unsafe: true } });
    this.shards = [];
  }
  makeCrackTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const x = cv.getContext('2d'); const r = rng(Math.floor(this.c[0] * 31 + this.c[2] * 17));
    x.strokeStyle = 'rgba(235,240,235,0.9)'; x.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      let px = 256 + (r() - 0.5) * 60, py = 256 + (r() - 0.5) * 60;
      let a = r() * Math.PI * 2;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 12; k++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * 22; py += Math.sin(a) * 22; x.lineTo(px, py); }
      x.stroke();
    }
    for (let ring = 1; ring < 4; ring++) { x.beginPath(); for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2; const rr = ring * 50 + r() * 14; x.lineTo(256 + Math.cos(a) * rr, 256 + Math.sin(a) * rr); } x.globalAlpha = 0.5; x.stroke(); x.globalAlpha = 1; }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  fixedUpdate(dt) {
    if (this.broken) return;
    const { load } = loadOn(this.L, this.collider);
    this.load = load;
    if (load >= this.limit) {
      const before = this.strain;
      this.strain += dt;
      if (before < 0.05 && this.strain >= 0.05) audio.play('glassCrack', { pos: V(...this.c) });
      if (before < 0.4 && this.strain >= 0.4) audio.play('glassCrack', { pos: V(...this.c) });
      if (this.strain > 0.75) this.shatter();
    } else if (load >= this.limit - 1) {
      this.strain = Math.max(this.strain, 0.15);
    } else this.strain = Math.max(0, this.strain - dt * 0.1);
  }
  shatter() {
    this.broken = true;
    this.L.phys.remove(this.collider); this.collider = null;
    this.mesh.visible = false; this.crack.visible = false;
    audio.play('glassBreak', { pos: V(...this.c) });
    const r = rng(5);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.12, 0, 0.03, 0.04, 0, 0.11], 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#cfd8d2', transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.05 });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(this.min[0] + r() * (this.max[0] - this.min[0]), this.max[1], this.min[2] + r() * (this.max[2] - this.min[2]));
      m.scale.setScalar(0.5 + r() * 1.5);
      m.rotation.set(r() * 6, r() * 6, r() * 6);
      this.L.root.add(m);
      this.shards.push({ m, v: V((r() - 0.5) * 2, -r() * 2, (r() - 0.5) * 2), w: V(r() * 9, r() * 9, r() * 9), life: 3 });
    }
  }
  update(dt) {
    if (!this.broken) this.crack.material.opacity = damp(this.crack.material.opacity, clamp(this.strain * 1.3, 0, 1), 8, dt);
    for (const s of this.shards) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt;
      if (s.life <= 0) s.m.visible = false;
    }
  }
  get active() { return this.broken; }
  reset() {
    if (this.broken) {
      this.collider = this.L.phys.fixedBox(this.c, this.h, { info: { kind: 'static', surface: 'metal', owner: this, unsafe: true } });
      this.mesh.visible = true; this.crack.visible = true;
      for (const s of this.shards) this.L.root.remove(s.m);
      this.shards = [];
    }
    this.broken = false; this.strain = 0;
  }
}

// ---------------------------------------------------------------- brine channel
let rippleCache = null;
export class Brine extends Element {
  constructor(L, { min, max, current = [0, 0], buoyancy = 2.5, color = '#1d2b25' }) {
    super(L);
    this.kind = 'brine';
    this.min = min; this.max = max; this.surface = max[1];
    this.current = current; this.B = buoyancy;
    if (!rippleCache) rippleCache = this.game.engine.materials.texgen.get('ripple', { tint: '#ffffff', size: 512 });
    const n = rippleCache.normalMap;
    this.nTex = n;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.1, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.94, envMapIntensity: 1.4 });
    const pg = new THREE.PlaneGeometry(max[0] - min[0], max[2] - min[2]);
    const uva = pg.attributes.uv; for (let i = 0; i < uva.count; i++) uva.setXY(i, uva.getX(i) * (max[0] - min[0]) / 3, uva.getY(i) * (max[2] - min[2]) / 3);
    const m = new THREE.Mesh(pg, mat);
    m.rotation.x = -Math.PI / 2; m.position.set((min[0] + max[0]) / 2, this.surface, (min[2] + max[2]) / 2);
    m.receiveShadow = true;
    L.root.add(m);
    this.mesh = m;
    this.lost = new Map();
    this.t = 0;
    this.snd = null;
  }
  inside(x, z) { return x > this.min[0] && x < this.max[0] && z > this.min[2] && z < this.max[2]; }
  setLevel(y) { this.surface = y; this.mesh.position.y = y; this.mesh.visible = y > this.min[1] + 0.02; }
  fixedUpdate(dt) {
    const c = [(this.min[0] + this.max[0]) / 2, (this.min[1] + this.surface) / 2 + 0.5, (this.min[2] + this.max[2]) / 2];
    const hh = [(this.max[0] - this.min[0]) / 2, (this.surface - this.min[1]) / 2 + 0.5, (this.max[2] - this.min[2]) / 2];
    const cols = this.L.phys.overlapBox(c, hh, GROUPS.aim);
    const seen = new Set();
    for (const col of cols) {
      const b = col.parent();
      if (!b || !b.isDynamic() || seen.has(b.handle)) continue;
      seen.add(b.handle);
      const info = this.L.phys.infoOf(col);
      const o = info?.owner;
      const size = o?.size || 0.7;
      const t = b.translation();
      const bottom = t.y - size / 2;
      const sub = clamp((this.surface - bottom) / size, 0, 1);
      if (sub <= 0) continue;
      if (!o?.inBrine && sub > 0.05) { o && (o.inBrine = true); audio.play('splash', { pos: V(t.x, this.surface, t.z), gain: 0.7 }); }
      const m = b.mass();
      const lv = b.linvel();
      const ay = (G / 2) * this.B * sub;
      const cx = this.current[0], cz = this.current[1];
      b.applyImpulse({ x: ((cx - lv.x) * 1.5 * sub) * m * dt, y: (ay - lv.y * 1.6 * sub) * m * dt, z: ((cz - lv.z) * 1.5 * sub) * m * dt }, true);
      const av = b.angvel();
      b.setAngvel({ x: av.x * 0.96, y: av.y * 0.98, z: av.z * 0.96 }, true);
      // sunk to the bottom: count as lost after a while
      if (o && bottom < this.min[1] + 0.15) {
        const tl = (this.lost.get(o) || 0) + dt; this.lost.set(o, tl);
        if (tl > 2.5) { this.lost.delete(o); o.inBrine = false; this.L.lostObject(o); }
      }
    }
    // the player
    const p = this.game.player;
    const f = p.feet(V());
    if (this.inside(f.x, f.z) && f.y < this.surface - 0.25 && f.y > this.min[1] - 1) {
      audio.play('splash', { pos: f, gain: 1 });
      this.game.playerDied('brine');
    }
  }
  update(dt) {
    this.t += dt;
    const T = this.game.engine.time;
    this.nTex.offset.set(T * 0.02, T * 0.013);
  }
}

// ---------------------------------------------------------------- self-tare booth
export class Booth extends Element {
  constructor(L, { pos, rotY = 0, range = [1, 4], name = null }) {
    super(L);
    this.kind = 'booth';
    this.pos = pos; this.rotY = rotY; this.range = range;
    const W = 1.2, D = 1.2, H = 2.5;
    const p = pos;
    // walls: back + sides in veneer with glass upper panes; front open
    L.solidLocal(p, rotY, [-W / 2, 0, -D / 2 - 0.06], [W / 2, H, -D / 2], 'veneer_walnut', { surface: 'wood' });
    for (const s of [-1, 1]) {
      L.solidLocal(p, rotY, [s * W / 2 - (s > 0 ? 0 : 0.06), 0, -D / 2], [s * W / 2 + (s > 0 ? 0.06 : 0), 1.1, D / 2], 'veneer_walnut', { surface: 'wood' });
      L.visualLocal(p, rotY, [s * W / 2 - (s > 0 ? 0 : 0.06), 1.1, -D / 2], [s * W / 2 + (s > 0 ? 0.06 : 0), H, -D / 2 + 0.06], 'veneer_walnut');
      L.visualLocal(p, rotY, [s * W / 2 - (s > 0 ? 0 : 0.06), 1.1, D / 2 - 0.06], [s * W / 2 + (s > 0 ? 0.06 : 0), H, D / 2], 'veneer_walnut');
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.12, H - 1.2), this.mats.glass({ opacity: 0.2 }));
      const gp = V(s * W / 2, 1.1 + (H - 1.2) / 2, 0).applyAxisAngle(UP, rotY).add(V(...p));
      gl.position.copy(gp); gl.rotation.y = rotY + Math.PI / 2; L.root.add(gl);
      L.phys.fixedBox([gp.x, gp.y, gp.z], [0.03, (H - 1.2) / 2, (D - 0.12) / 2], { rot: rq(qY(rotY)), info: { kind: 'static', surface: 'wood' } });
    }
    L.solidLocal(p, rotY, [-W / 2 - 0.06, H, -D / 2 - 0.06], [W / 2 + 0.06, H + 0.1, D / 2], 'veneer_walnut', { surface: 'wood' });
    L.visualLocal(p, rotY, [-W / 2 + 0.05, 0, -D / 2 + 0.05], [W / 2 - 0.05, 0.03, D / 2 - 0.05], 'rubber', { grime: false });
    this.floorCol = L.phys.fixedBox(V(0, 0.015, 0).applyAxisAngle(UP, rotY).add(V(...p)).toArray(), [W / 2 - 0.05, 0.015, D / 2 - 0.05], { rot: rq(qY(rotY)), info: { kind: 'static', surface: 'rubber', owner: this } });
    // the dial you aim at
    const dp = V(0, 1.55, -D / 2 + 0.01).applyAxisAngle(UP, rotY).add(V(...p));
    this.dial = new Dial(L, { pos: [dp.x, dp.y - 0.15, dp.z], rotY, tilt: 0, min: -4, max: 6, label: 'YOUR WEIGHT', post: 0, r: 0.2 });
    const col = L.phys.fixedCollider(R.ColliderDesc.cuboid(0.24, 0.24, 0.05).setTranslation(dp.x, dp.y - 0.03, dp.z).setRotation(rq(qY(rotY))), { kind: 'boothDial', owner: this }, GROUPS.rayOnly);
    this.dialCol = col;
    const plaque = signTexture(['SELF-TARE', `PERMITTED ${range[0] < 0 ? '−' + -range[0] : range[0]} TO ${range[1]}`], { style: 'plate', bg: '#b89a5a', fg: '#2a2218', w: 512, h: 160 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshStandardMaterial({ map: plaque, metalness: 0.7, roughness: 0.35 }));
    const pp = V(0, 2.1, -D / 2 + 0.012).applyAxisAngle(UP, rotY).add(V(...p));
    pl.position.copy(pp); pl.rotation.y = rotY; L.root.add(pl);
    const lamp = this.L.props.pendant([p[0], p[1] + H - 0.05, p[2]], { intensity: 3, drop: 0.05, shade: 'brass', distance: 4 });
    void lamp;
    if (name) L.named[name] = this;
  }
  contains(pt) {
    const l = pt.clone().sub(V(...this.pos)).applyAxisAngle(UP, -this.rotY);
    return Math.abs(l.x) < 0.6 && Math.abs(l.z) < 0.6 && l.y > -0.5 && l.y < 2.6;
  }
  update(dt) {
    const p = this.game.player;
    const inside = this.contains(p.feet(V()));
    this.dial.set(inside ? p.weight : 0, inside);
    this.dial.update(dt);
  }
}

// ---------------------------------------------------------------- hopper (crate dispenser)
export class Hopper extends Element {
  constructor(L, { pos, crate }) {
    super(L);
    this.kind = 'hopper';
    this.pos = pos;
    this.crate = crate;
    crate.spawn.pos = [pos[0], pos[1] - 1.2, pos[2]];
    crate.hopper = this;
    const p = pos;
    L.visual([p[0] - 0.5, p[1] - 0.15, p[2] - 0.5], [p[0] + 0.5, p[1] + 1.5, p[2] - 0.42], 'paint_ochre', { grime: false });
    L.visual([p[0] - 0.5, p[1] - 0.15, p[2] + 0.42], [p[0] + 0.5, p[1] + 1.5, p[2] + 0.5], 'paint_ochre', { grime: false });
    L.visual([p[0] - 0.5, p[1] - 0.15, p[2] - 0.42], [p[0] - 0.42, p[1] + 1.5, p[2] + 0.42], 'paint_ochre', { grime: false });
    L.visual([p[0] + 0.42, p[1] - 0.15, p[2] - 0.42], [p[0] + 0.5, p[1] + 1.5, p[2] + 0.42], 'paint_ochre', { grime: false });
    this.flaps = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.84), this.mats.get('paint_black'));
      const g = new THREE.Group(); g.position.set(p[0] + s * 0.42, p[1] - 0.15, p[2]); f.position.x = -s * 0.21; g.add(f);
      L.root.add(g); this.flaps.push({ g, s });
    }
    this.flapT = 0;
  }
  drop() { this.crate.respawn(true); this.flapT = 1.2; audio.play('clank', { pos: V(...this.pos), gain: 0.8 }); }
  update(dt) {
    this.flapT = Math.max(0, this.flapT - dt);
    const a = this.flapT > 0 ? Math.min(1, this.flapT * 3) * 1.4 : 0;
    for (const f of this.flaps) f.g.rotation.z = -f.s * a;
  }
}

// ---------------------------------------------------------------- button and lever
export class Button extends Element {
  constructor(L, { pos, rotY = 0, wall = false, onPress = null, label = 'Press', cap = '#8e3526', momentary = 0.6 }) {
    super(L);
    this.kind = 'button';
    this.pos = pos; this.onPress = onPress; this.prompt = label; this.momentary = momentary;
    this.on = 0;
    const p = pos;
    if (!wall) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.95, 16), this.mats.get('paint_black'));
      col.position.set(p[0], p[1] + 0.475, p[2]); col.castShadow = true; L.root.add(col);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.1, 20), this.mats.get('brass'));
      head.position.set(p[0], p[1] + 1.0, p[2]); L.root.add(head);
      this.cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.06, 20), this.mats.plain(cap, { rough: 0.3 }));
      this.cap.position.set(p[0], p[1] + 1.08, p[2]); L.root.add(this.cap);
      this.capY = p[1] + 1.08;
      L.phys.fixedBox([p[0], p[1] + 0.55, p[2]], [0.13, 0.55, 0.13], { info: { kind: 'static', owner: this, interact: true, surface: 'metal' } });
    } else {
      const q = qY(rotY);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.1), this.mats.get('paint_grey'));
      box.position.set(...p); box.quaternion.copy(q); L.root.add(box);
      this.cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), this.mats.plain(cap, { rough: 0.3 }));
      const cp = V(0, 0, 0.07).applyAxisAngle(UP, rotY).add(V(...p));
      this.cap.position.copy(cp); this.cap.quaternion.copy(q); this.cap.rotateX(Math.PI / 2); L.root.add(this.cap);
      L.phys.fixedBox(p, [0.13, 0.17, 0.13], { rot: rq(q), info: { kind: 'static', owner: this, interact: true, surface: 'metal' } });
      this.capY = null; this.capBase = cp.clone(); this.capDir = V(0, 0, -1).applyAxisAngle(UP, rotY);
    }
  }
  get active() { return this.on > 0; }
  interact() {
    this.on = this.momentary;
    audio.play('relay', { pos: V(...this.pos) });
    audio.play('tick', { pos: V(...this.pos) });
    this.onPress?.();
  }
  update(dt) {
    this.on = Math.max(0, this.on - dt);
    const d = this.on > 0 ? 0.02 : 0;
    if (this.capY !== null) this.cap.position.y = damp(this.cap.position.y, this.capY - d, 20, dt);
    else this.cap.position.copy(this.capBase).addScaledVector(this.capDir, d);
  }
}

export class Lever extends Element {
  constructor(L, { pos, rotY = 0, on = false, label = 'Pull lever', onChange = null }) {
    super(L);
    this.kind = 'lever';
    this.state = on; this.initial = on; this.prompt = label; this.onChange = onChange;
    const q = qY(rotY);
    const base = new THREE.Mesh(boxGeom([-0.18, -0.25, -0.06], [0.18, 0.25, 0.06], { bevel: 0.015, grime: false }), this.mats.get('paint_grey'));
    base.position.set(...pos); base.quaternion.copy(q); L.root.add(base);
    this.arm = new THREE.Group();
    const ap = V(0, 0, 0.07).applyAxisAngle(UP, rotY).add(V(...pos));
    this.arm.position.copy(ap); this.arm.quaternion.copy(q); L.root.add(this.arm);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 8), this.mats.get('steel'));
    rod.position.y = 0.2; this.arm.add(rod);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), this.mats.get('bakelite_black'));
    knob.position.y = 0.42; this.arm.add(knob);
    L.phys.fixedBox(pos, [0.2, 0.3, 0.15], { rot: rq(q), info: { kind: 'static', owner: this, interact: true, surface: 'metal' } });
    this.angle = on ? -0.7 : 0.7;
    this.pos = pos;
  }
  get active() { return this.state; }
  interact() { this.state = !this.state; audio.play('clank', { pos: V(...this.pos), gain: 0.5 }); this.onChange?.(this.state); }
  update(dt) { this.angle = damp(this.angle, this.state ? -0.7 : 0.7, 10, dt); this.arm.rotation.x = this.angle; }
  reset() { this.state = this.initial; }
}

// ---------------------------------------------------------------- spring plate (launcher)
export class Launcher extends Element {
  constructor(L, { pos, vel = [0, 7, 4], delay = 0.7, size = 1.1, when = null }) {
    super(L);
    this.kind = 'launcher';
    this.pos = pos; this.vel = V(...vel); this.delay = delay; this.size = size;
    this.trigger = when ? cond(when) : null;
    this.timer = 0; this.anim = 0;
    const s = size / 2;
    L.visual([pos[0] - s - 0.08, pos[1] - 0.02, pos[2] - s - 0.08], [pos[0] + s + 0.08, pos[1] + 0.02, pos[2] + s + 0.08], 'steel_dark', { grime: false });
    this.top = new THREE.Group();
    const plate = new THREE.Mesh(boxGeom([-s, 0, -s], [s, 0.06, s], { bevel: 0.012, grime: false }), this.mats.get('paint_ochre'));
    plate.castShadow = plate.receiveShadow = true; this.top.add(plate);
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.6, size * 0.6), new THREE.MeshStandardMaterial({ map: signTexture(['▲'], { style: 'stencil', fg: '#1f1d1a', w: 256, h: 256, size: 200 }), transparent: true, depthWrite: false }));
    arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = -Math.atan2(this.vel.x, -this.vel.z) + Math.PI; arrow.position.y = 0.062; this.top.add(arrow);
    this.top.position.set(pos[0], pos[1] + 0.02, pos[2]);
    L.root.add(this.top);
    this.springs = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const sp = new THREE.Mesh(new THREE.TorusKnotGeometry(0.05, 0.008, 40, 6, 1, 8), this.mats.get('steel'));
      sp.position.set(pos[0] + x * s * 0.6, pos[1] + 0.05, pos[2] + z * s * 0.6); sp.rotation.x = Math.PI / 2;
      L.root.add(sp); this.springs.push(sp);
    }
    this.collider = L.phys.fixedBox([pos[0], pos[1] + 0.05, pos[2]], [s, 0.04, s], { info: { kind: 'static', surface: 'metal', owner: this } });
  }
  speedFor(w) { return Math.pow(2 / Math.max(0.5, w), 0.5); }
  fixedUpdate(dt) {
    const { load, bodies } = loadOn(this.L, this.collider);
    const p = this.game.player;
    const playerOn = p.grounded && p.groundCollider && p.groundCollider.handle === this.collider.handle;
    const occupied = bodies.size > 0 || playerOn;
    const go = this.trigger ? this.trigger() : occupied;
    if (go && occupied) this.timer += dt; else this.timer = 0;
    if (this.timer > this.delay) {
      this.timer = -1.2;
      this.anim = 1;
      audio.play('clank', { pos: V(...this.pos), gain: 1 });
      audio.play('impact', { pos: V(...this.pos), intensity: 1, weight: 1, material: 'metal' });
      for (const h of bodies) {
        const b = this.L.phys.world.getRigidBody(h);
        if (!b || !b.isDynamic()) continue;
        const o = this.L.weightedByBody(b);
        const k = this.speedFor(o ? o.weight : 2);
        b.setLinvel({ x: this.vel.x * k, y: this.vel.y * k, z: this.vel.z * k }, true);
      }
      if (playerOn) {
        const carried = this.game.tare?.held ? this.game.tare.held.weight : 0;
        const k = this.speedFor(p.weight + carried);
        p.vel.copy(this.vel).multiplyScalar(k);
        p.grounded = false; p.coyote = 0;
      }
    }
    void load;
  }
  update(dt) {
    this.anim = Math.max(0, this.anim - dt * 3);
    const lift = Math.sin(this.anim * Math.PI) * 0.35;
    this.top.position.y = this.pos[1] + 0.02 + lift;
    for (const s of this.springs) s.scale.z = 1 + lift * 6;
  }
}

// ---------------------------------------------------------------- notes and documents
export class Note extends Element {
  constructor(L, { pos, rotY = 0, doc, kind = 'paper', wall = false, onRead = null, id = null }) {
    super(L);
    this.kind = 'note';
    this.doc = doc; this.onRead = onRead; this.id = id || doc.id || doc.title;
    this.prompt = kind === 'photo' ? 'Look at photograph' : 'Read';
    const p = pos;
    let mesh;
    if (kind === 'clipboard') {
      mesh = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.33), this.mats.get('planks_dark'));
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), this.mats.get('paper'));
      sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0.004, 0.01);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.03), this.mats.get('steel'));
      clip.position.set(0, 0.01, -0.15);
      mesh.add(board, sheet, clip);
    } else if (kind === 'photo') {
      mesh = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.015), this.mats.get('veneer_walnut'));
      const tex = doc.photoTexture || labelTexture('PHOTO', { w: 128, h: 160, hole: false });
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      pic.position.z = 0.009;
      mesh.add(frame, pic);
    } else {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297), this.mats.get('paper'));
      if (!wall) mesh.rotation.x = -Math.PI / 2;
    }
    mesh.position.set(...p);
    if (wall) mesh.rotation.y = rotY; else mesh.rotation.y = rotY;
    if (kind === 'paper' && !wall) { mesh.rotation.set(-Math.PI / 2, 0, rotY); mesh.position.y += 0.003; }
    mesh.traverse(o => { o.castShadow = false; o.receiveShadow = true; });
    L.root.add(mesh);
    this.mesh = mesh;
    const hs = kind === 'photo' ? [0.12, 0.15, 0.04] : [0.16, 0.06, 0.2];
    L.phys.fixedCollider(R.ColliderDesc.cuboid(...hs).setTranslation(...p).setRotation(rq(qY(rotY))), { kind: 'note', owner: this, interact: true }, GROUPS.rayOnly);
    // a faint highlight so documents can be found without a waypoint
    this.read = this.game.save?.hasRead?.(this.id) || false;
  }
  interact() {
    audio.play('paper');
    this.game.ui.showDocument(this.doc, () => { this.onRead?.(); });
    if (!this.read) { this.read = true; this.game.save?.markRead?.(this.id, this.doc); }
  }
}

// ---------------------------------------------------------------- trigger volumes
export class Trigger extends Element {
  constructor(L, { min, max, once = true, onEnter = null, onExit = null, onStay = null }) {
    super(L);
    this.min = min; this.max = max; this.once = once; this.onEnter = onEnter; this.onExit = onExit; this.onStay = onStay;
    this.inside = false; this.fired = false;
  }
  contains(p) { return p.x > this.min[0] && p.x < this.max[0] && p.y > this.min[1] && p.y < this.max[1] && p.z > this.min[2] && p.z < this.max[2]; }
  fixedUpdate(dt) {
    if (this.once && this.fired) return;
    const f = this.game.player.feet(V()).add(V(0, 0.3, 0));
    const now = this.contains(f);
    if (now && !this.inside) { this.fired = true; this.onEnter?.(); }
    if (!now && this.inside) this.onExit?.();
    if (now) this.onStay?.(dt);
    this.inside = now;
  }
}

// ---------------------------------------------------------------- the lift cage (chamber to chamber)
export class Cage extends Element {
  constructor(L, { pos, rotY = 0, role = 'exit', text = '', when = true }) {
    super(L);
    this.kind = 'cage';
    this.role = role; this.pos = pos; this.rotY = rotY;
    this.cond = cond(when);
    const W = 2.4, D = 2.4, H = 2.7, t = 0.08;
    const p = pos;
    // shaft surround (so the cage sits in a concrete well)
    L.solidLocal(p, rotY, [-W / 2 - 0.4, -0.3, -D / 2 - 0.4], [W / 2 + 0.4, 0, D / 2], 'concrete_dark', { surface: 'stone' });
    L.solidLocal(p, rotY, [-W / 2 - 0.4, H + 0.2, -D / 2 - 0.4], [W / 2 + 0.4, H + 0.6, D / 2], 'concrete_dark', { surface: 'stone' });
    L.solidLocal(p, rotY, [-W / 2 - 0.4, 0, -D / 2 - 0.4], [-W / 2, H + 0.2, D / 2], 'concrete_dark', { surface: 'stone' });
    L.solidLocal(p, rotY, [W / 2, 0, -D / 2 - 0.4], [W / 2 + 0.4, H + 0.2, D / 2], 'concrete_dark', { surface: 'stone' });
    L.solidLocal(p, rotY, [-W / 2, 0, -D / 2 - 0.4], [W / 2, H + 0.2, -D / 2], 'concrete_dark', { surface: 'stone' });
    // car interior: chequer floor, panelled walls, brass rail, lamp
    L.visualLocal(p, rotY, [-W / 2 + t, 0, -D / 2 + t], [W / 2 - t, 0.02, D / 2 - t], 'steel_dark', { grime: false });
    for (const s of [-1, 1]) {
      L.visualLocal(p, rotY, [s > 0 ? W / 2 - t : -W / 2, 0, -D / 2], [s > 0 ? W / 2 : -W / 2 + t, H, D / 2 - 0.12], 'paint_cream');
      L.visualLocal(p, rotY, [s > 0 ? W / 2 - t - 0.02 : -W / 2 + t, 0.9, -D / 2 + 0.2], [s > 0 ? W / 2 - t : -W / 2 + t + 0.02, 0.95, D / 2 - 0.3], 'brass');
    }
    L.visualLocal(p, rotY, [-W / 2, 0, -D / 2], [W / 2, H, -D / 2 + t], 'paint_cream');
    L.visualLocal(p, rotY, [-W / 2, 0, -D / 2 + t], [W / 2, 0.15, -D / 2 + t + 0.01], 'steel');
    L.visualLocal(p, rotY, [-W / 2, H - 0.05, -D / 2], [W / 2, H, D / 2], 'paint_cream');
    L.props.bulkhead(L.props.localToWorld(p, rotY, [0, H - 0.08, -D / 2 + t + 0.01]), rotY, { intensity: 4, distance: 5 });
    // notice + flip display above the door, facing in
    const notice = signTexture(['CAPACITY', '2 PERSONS · 9 MEASURES'], { style: 'plate', bg: '#b89a5a', fg: '#2a2218', w: 512, h: 160 });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshStandardMaterial({ map: notice, metalness: 0.7, roughness: 0.4 }));
    const np = V(-0.6, 1.55, -D / 2 + t + 0.005).applyAxisAngle(UP, rotY).add(V(...p));
    nm.position.copy(np); nm.rotation.y = rotY; L.root.add(nm);
    this.flapTex = flapTexture(text || ' ', { cells: 12 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.2), new THREE.MeshStandardMaterial({ map: this.flapTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: this.flapTex, emissiveIntensity: 0.15 }));
    const fp = V(0, H - 0.3, D / 2 - 0.13).applyAxisAngle(UP, rotY).add(V(...p));
    fl.position.copy(fp); fl.rotation.y = rotY + Math.PI; L.root.add(fl);
    this.flapMesh = fl;
    // folding gate (vertical bars) on the open side, slides sideways
    this.gate = new THREE.Group();
    const bars = [];
    for (let i = 0; i < 13; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.025, H - 0.1, 0.025), this.mats.get('brass'));
      b.position.set(-W / 2 + 0.15 + i * 0.17, (H - 0.1) / 2, 0); this.gate.add(b); bars.push(b);
    }
    for (const y of [0.1, H / 2, H - 0.15]) { const r = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.03, 0.03), this.mats.get('brass')); r.position.set(0, y, 0); this.gate.add(r); }
    this.gatePos = V(0, 0, D / 2 - 0.06);
    this.gate.position.copy(this.gatePos.clone().applyAxisAngle(UP, rotY).add(V(...p)));
    this.gate.rotation.y = rotY;
    L.root.add(this.gate);
    this.gateBody = L.phys.kinematicBody(this.gate.position.toArray(), rq(qY(rotY)));
    L.phys.attach(R.ColliderDesc.cuboid(W / 2, H / 2, 0.05).setTranslation(0, H / 2, 0), this.gateBody, { kind: 'static', surface: 'metal' }, GROUPS.static);
    // floor collider for the car itself
    L.phys.fixedBox(V(0, 0.01, 0).applyAxisAngle(UP, rotY).add(V(...p)).toArray(), [W / 2, 0.01, D / 2], { rot: rq(qY(rotY)), info: { kind: 'static', surface: 'metal' } });
    this.open = role === 'exit' ? 0 : 0;
    this.target = 0;
    this.W = W; this.D = D;
    this.occupied = false;
    this.armed = role === 'exit';
    this.sync();
  }
  contains(pt) {
    const l = pt.clone().sub(V(...this.pos)).applyAxisAngle(UP, -this.rotY);
    return Math.abs(l.x) < this.W / 2 - 0.1 && l.z > -this.D / 2 && l.z < this.D / 2 - 0.25 && l.y > -0.5 && l.y < 2.5;
  }
  setText(t) {
    const old = this.flapTex;
    this.flapTex = flapTexture(t, { cells: 12 });
    this.flapMesh.material.map = this.flapTex; this.flapMesh.material.emissiveMap = this.flapTex; this.flapMesh.material.needsUpdate = true;
    old.dispose();
    audio.play('flap', { count: 10 });
  }
  fixedUpdate(dt) {
    const inside = this.contains(this.game.player.feet(V()));
    if (this.role === 'exit') {
      if (this.armed && this.cond()) this.target = 1;
      if (inside && this.armed && this.open > 0.9) {
        this.dwell = (this.dwell || 0) + dt;
        if (this.dwell > 0.9) { this.armed = false; this.target = 0; this.game.beginTransition(this); }
      } else this.dwell = 0;
    }
    const before = this.open;
    this.open = clamp(this.open + Math.sign(this.target - this.open) * dt * 1.1, 0, 1);
    if (before !== this.open && (this.open === 0 || this.open === 1)) audio.play('clank', { pos: V(...this.pos), gain: 0.5 });
    if (before !== this.open && before === (this.target ? 0 : 1)) audio.play('relay', { pos: V(...this.pos) });
    this.sync();
  }
  openGate() { this.target = 1; }
  closeGate() { this.target = 0; }
  // While the car "moves", a concrete shaft wall slides past outside the gate.
  ride(on) {
    if (!this.liner) {
      const mat = this.mats.get('concrete_dark');
      const W = this.W + 0.8, H = 3.6;
      const g = new THREE.PlaneGeometry(W, H);
      this.linerUV = g.attributes.uv.array.slice();
      const m = new THREE.Mesh(g, mat);
      const lp = V(0, 1.35, this.D / 2 + 0.22).applyAxisAngle(UP, this.rotY).add(V(...this.pos));
      m.position.copy(lp); m.rotation.y = this.rotY + Math.PI;
      this.L.root.add(m);
      const band = new THREE.Mesh(new THREE.BoxGeometry(W, 0.35, 0.3), this.mats.get('concrete'));
      band.position.set(0, 0, 0.1); m.add(band);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), this.mats.emissive('#ffd9a0', 2));
      lamp.position.set(0.6, 0, 0.05); m.add(lamp);
      this.liner = m; this.linerBand = band; this.linerLamp = lamp; this.linerT = 0;
      this.linerW = W; this.linerH = H;
    }
    this.liner.visible = on; this.riding = on;
  }
  update(dt) {
    if (!this.riding || !this.liner) return;
    this.linerT += dt;
    const uv = this.liner.geometry.attributes.uv;
    const off = this.linerT * 0.9;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, this.linerUV[i * 2] * this.linerW, this.linerUV[i * 2 + 1] * this.linerH + off);
    uv.needsUpdate = true;
    const y = ((this.linerT * 2.1) % 4.5) - 2.25;
    this.linerBand.position.y = y; this.linerLamp.position.y = y - 0.3;
  }
  sync() {
    const off = this.gatePos.clone().add(V(this.open * (this.W - 0.35), 0, 0)).applyAxisAngle(UP, this.rotY).add(V(...this.pos));
    this.gate.position.copy(off);
    this.gateBody.setNextKinematicTranslation({ x: off.x, y: off.y, z: off.z });
    this.gate.children.forEach((b, i) => { if (i < 13) b.position.x = -this.W / 2 + 0.15 + i * 0.17 * (1 - this.open * 0.85); });
  }
  // world <-> cage-local transforms (for the seamless swap between chambers)
  toLocal(v) { return v.clone().sub(V(...this.pos)).applyAxisAngle(UP, -this.rotY); }
  toWorld(v) { return v.clone().applyAxisAngle(UP, this.rotY).add(V(...this.pos)); }
}

// Iron ballast bolted to a lift cage: weighted (draw/give), rides with the cage.
class LiftBallast extends Weighted {
  constructor(L, lift, side, weight, flank = 1) {
    super(L, { weight, min: 0, max: 9, name: 'cage ballast', carriable: false });
    this.fixed = true; this.kind = 'ballast';
    L.weighted.push(this); L.entities.push(this);
    const plat = lift.plats[side];
    const [w, d] = lift.size;
    const g = new THREE.Group();
    const block = new THREE.Mesh(boxGeom([-0.32, 0, -0.22], [0.32, 0.5, 0.22], { bevel: 0.02, grime: false }), L.game.engine.materials.get('paint_black', { param: 0.7 }));
    block.castShadow = block.receiveShadow = true; g.add(block);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 16), L.game.engine.materials.get('steel_dark'));
    ring.position.y = 0.56; g.add(ring);
    for (const s2 of [1, -1]) {
      const dr = new Drum(0.15); dr.mesh.position.set(0, 0.27, s2 * 0.226); if (s2 < 0) dr.mesh.rotation.y = Math.PI; g.add(dr.mesh); dr.set(weight); this.drums.push(dr);
    }
    // hung on the outside flank of the cage, so it can be seen from above and below
    const lx = flank * (w / 2 + 0.26), ly = 0.75;
    g.rotation.y = flank * Math.PI / 2;
    g.position.set(lx, ly, 0);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), L.game.engine.materials.get('paint_black'));
    bracket.position.set(flank * (w / 2 + 0.12), ly - 0.03, 0);
    plat.g.add(g, bracket);
    this.object = g;
    this.collider = L.phys.attach(R.ColliderDesc.cuboid(0.22, 0.25, 0.32).setTranslation(lx, ly + 0.25, 0), plat.body, { kind: 'static', owner: this, surface: 'metal' }, GROUPS.static);
  }
  position(out = new THREE.Vector3()) { return this.object.getWorldPosition(out).add(new THREE.Vector3(0, 0.3, 0)); }
  update(dt) { this.shake = Math.max(0, this.shake - dt); this.updateDrums(dt); }
}

// ---------------------------------------------------------------- twinned crates
// Two bodies that always share their measures equally (one measure flows at a time).
export class Twins extends Element {
  constructor(L, { a, b, mark = '\u25C6' }) {
    super(L);
    this.kind = 'twins';
    this.a = a; this.b = b; this.t = 0;
    const tex = signTexture([mark + ' TWIN ' + mark], { bg: '#3f5867', fg: '#efe7d2', w: 256, h: 64 });
    for (const o of [a, b]) {
      for (const f of [1, 3]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3 }));
        const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][f];
        const h = (o.size || 0.7) / 2 + 0.006;
        m.position.set(Math.sin(ang) * h, 0.24, Math.cos(ang) * h); m.rotation.y = ang;
        o.object.add(m);
      }
    }
  }
  fixedUpdate(dt) {
    this.t += dt;
    if (this.t < 0.45) return;
    const d = this.a.weight - this.b.weight;
    if (Math.abs(d) >= 2) {
      this.t = 0;
      const [hi, lo] = d > 0 ? [this.a, this.b] : [this.b, this.a];
      hi.setWeight(hi.weight - 1); lo.setWeight(lo.weight + 1);
      audio.play('tick', { pos: lo.position() });
      audio.play('tick', { when: 0.08, pos: hi.position() });
      this.game.tare.fx(true, { kind: 'weighted', obj: lo, point: lo.position() });
    }
  }
}
