// Prop library. Most props are written straight into the level's static batch (so a
// room full of furniture costs a handful of draw calls); things with their own
// textures (signs, clock faces, posters) are separate meshes.
import * as THREE from 'three';
import { boxGeom, prepGeom, tmpMatrix } from './geometry.js';
import { signTexture, posterTexture, FONTS, INK } from './signs.js';
import { rng } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V(0, 1, 0);

export class Props {
  constructor(L) { this.L = L; this.r = rng(L.seed || 7); }
  get mats() { return this.L.game.engine.materials; }

  // add a local geometry, transformed by (pos, rotY), into the batch
  geo(g, mat, pos, rotY = 0, { scale = 1, rot = null, shadow = true, uv = 'world', uvScale = 1, grime = false } = {}) {
    const m = tmpMatrix(pos, rotY, scale, rot);
    const pg = prepGeom(g, m, { uv, uvScale, grime });
    this.L.batch.add(pg, typeof mat === 'string' ? this.mats.get(mat) : mat, { castShadow: shadow });
    g.dispose?.();
  }
  // local box from min/max relative to an origin + rotation
  box(origin, rotY, min, max, mat, opts = {}) {
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const g = opts.bevel ? boxGeom([-(max[0] - min[0]) / 2, -(max[1] - min[1]) / 2, -(max[2] - min[2]) / 2], [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2], { bevel: opts.bevel, grime: false })
      : new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const p = V(c[0], c[1], c[2]).applyAxisAngle(UPV, rotY).add(V(origin[0], origin[1], origin[2]));
    this.geo(g, mat, [p.x, p.y, p.z], rotY, opts);
  }
  cyl(origin, rotY, at, r0, r1, h, mat, { seg = 16, axis = 'y', ...opts } = {}) {
    const g = new THREE.CylinderGeometry(r0, r1, h, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    const p = V(at[0], at[1], at[2]).applyAxisAngle(UPV, rotY).add(V(origin[0], origin[1], origin[2]));
    this.geo(g, mat, [p.x, p.y, p.z], rotY, { uv: 'keep', ...opts });
  }
  mesh(geom, mat, pos, rotY = 0, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geom, typeof mat === 'string' ? this.mats.get(mat) : mat);
    m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = rotY;
    m.castShadow = cast; m.receiveShadow = receive;
    this.L.root.add(m);
    return m;
  }
  collider(center, half, rotY = 0, info = { kind: 'static', surface: 'wood' }) {
    const q = rotY ? new THREE.Quaternion().setFromAxisAngle(UPV, rotY) : null;
    return this.L.phys.fixedBox(center, half, { rot: q ? { x: q.x, y: q.y, z: q.z, w: q.w } : null, info });
  }

  // ------------------------------------------------------------------ lighting fixtures
  fluoro(pos, { len = 1.25, rotY = 0, intensity = 55, color = '#fff1dc', hang = 0, shadow = false, on = true, distance = 18, flicker = false } = {}) {
    const p = pos;
    this.box(p, rotY, [-0.11, -0.05, -len / 2], [0.11, 0.03, len / 2], 'paint_cream', { bevel: 0.01 });
    const tubeMat = on ? this.mats.emissive(color, 2.4) : this.mats.plain('#d8d4c8', { rough: 0.3 });
    for (const x of [-0.05, 0.05]) this.cyl(p, rotY, [x, -0.065, 0], 0.016, 0.016, len - 0.08, tubeMat, { axis: 'z', seg: 10, shadow: false });
    if (hang > 0) for (const z of [-len / 2 + 0.1, len / 2 - 0.1]) this.cyl(p, rotY, [0, 0.03 + hang / 2, z], 0.004, 0.004, hang, 'steel_dark', { seg: 4, shadow: false });
    if (!on) return null;
    const light = shadow ? new THREE.SpotLight(color, intensity * 2.2, distance, Math.PI * 0.42, 0.65, 2) : new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(p[0], p[1] - 0.12, p[2]);
    if (shadow) this.L.shadowSpot(light, [p[0], p[1] - 5, p[2]]);
    this.L.addLight(light, { flicker });
    return light;
  }

  pendant(pos, { intensity = 38, color = '#ffdcae', shade = 'paint_green', drop = 0.8, shadow = false, distance = 14, on = true } = {}) {
    const p = pos;
    const prof = [[0.02, 0.0], [0.05, -0.02], [0.08, -0.06], [0.2, -0.16], [0.24, -0.2], [0.235, -0.205], [0.195, -0.17], [0.075, -0.07], [0.0, -0.06]].map(([x, y]) => new THREE.Vector2(x, y));
    const shadeGeo = new THREE.LatheGeometry(prof, 32);
    this.geo(shadeGeo, this.mats.get(shade), p, 0, { uv: 'keep', uvScale: 3 });
    this.cyl(p, 0, [0, drop / 2, 0], 0.005, 0.005, drop, 'bakelite_black', { seg: 5, shadow: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), on ? this.mats.emissive(color, 4) : this.mats.plain('#bbb', {}));
    bulb.position.set(p[0], p[1] - 0.11, p[2]);
    this.L.root.add(bulb);
    if (!on) return null;
    const light = shadow ? new THREE.SpotLight(color, intensity * 2, distance, Math.PI * 0.38, 0.5, 2) : new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(p[0], p[1] - 0.15, p[2]);
    if (shadow) this.L.shadowSpot(light, [p[0], p[1] - 5, p[2]]);
    this.L.addLight(light);
    return light;
  }

  bulkhead(pos, rotY = 0, { intensity = 22, color = '#ffd29a', distance = 12, on = true, cage = true } = {}) {
    const p = pos;
    this.box(p, rotY, [-0.09, -0.09, 0], [0.09, 0.09, 0.05], 'paint_grey', { bevel: 0.01 });
    const dome = new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateX(Math.PI / 2);
    const d = this.mesh(dome, on ? this.mats.emissive(color, 1.6) : this.mats.glass(), [0, 0, 0]);
    const off = V(0, 0, 0.05).applyAxisAngle(UPV, rotY);
    d.position.set(p[0] + off.x, p[1] + off.y, p[2] + off.z); d.rotation.y = rotY;
    if (cage) for (let i = 0; i < 3; i++) {
      const t = new THREE.TorusGeometry(0.08, 0.004, 4, 20, Math.PI);
      t.rotateZ(i * Math.PI / 3); t.rotateY(Math.PI / 2); t.rotateY(-Math.PI / 2);
      this.geo(t, 'steel_dark', [p[0] + off.x, p[1], p[2] + off.z], rotY, { uv: 'keep', shadow: false });
    }
    if (!on) return null;
    const lp = V(0, 0, 0.18).applyAxisAngle(UPV, rotY);
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(p[0] + lp.x, p[1] + lp.y, p[2] + lp.z);
    this.L.addLight(light);
    return light;
  }

  // ------------------------------------------------------------------ furniture
  desk(pos, rotY = 0, { w = 1.4, d = 0.75, items = true, lamp = true, seed = null } = {}) {
    const r = seed !== null ? rng(seed) : this.r;
    const h = 0.76;
    this.box(pos, rotY, [-w / 2, h - 0.035, -d / 2], [w / 2, h, d / 2], 'veneer_oak', { bevel: 0.008 });
    // pedestal of drawers on the right, legs on the left
    this.box(pos, rotY, [w / 2 - 0.42, 0.05, -d / 2 + 0.03], [w / 2 - 0.03, h - 0.035, d / 2 - 0.03], 'paint_sage', { bevel: 0.006 });
    for (let i = 0; i < 3; i++) {
      const y0 = 0.08 + i * 0.205;
      this.box(pos, rotY, [w / 2 - 0.41, y0, d / 2 - 0.035], [w / 2 - 0.04, y0 + 0.19, d / 2 - 0.02], 'paint_sage', { bevel: 0.005 });
      this.box(pos, rotY, [w / 2 - 0.27, y0 + 0.08, d / 2 - 0.02], [w / 2 - 0.18, y0 + 0.1, d / 2 + 0.005], 'brass');
    }
    for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05]]) this.box(pos, rotY, [x - 0.025, 0, z - 0.025], [x + 0.025, h - 0.035, z + 0.025], 'paint_sage');
    this.box(pos, rotY, [-w / 2 + 0.05, 0.15, -d / 2 + 0.03], [-w / 2 + 0.07, 0.6, d / 2 - 0.03], 'paint_sage');
    this.collider(this.localToWorld(pos, rotY, [0, h / 2, 0]), [w / 2, h / 2, d / 2], rotY);
    if (items) {
      // blotter, a ledger, a cup, scattered papers
      this.box(pos, rotY, [-0.35, h, -0.2], [0.25, h + 0.004, 0.18], this.mats.plain('#2f4536', { rough: 0.9 }));
      if (r() < 0.8) this.ledger(this.localToWorld(pos, rotY, [-0.1 + r() * 0.1, h + 0.004, 0]), rotY + (r() - 0.5) * 0.3, { open: r() < 0.6 });
      if (r() < 0.75) this.mug(this.localToWorld(pos, rotY, [0.4, h, -0.1 - r() * 0.15]));
      for (let i = 0; i < 2 + Math.floor(r() * 4); i++) this.paper(this.localToWorld(pos, rotY, [(r() - 0.5) * w * 0.8, h + 0.002 + i * 0.0015, (r() - 0.5) * d * 0.6]), rotY + (r() - 0.5) * 0.8);
      if (r() < 0.5) this.typewriter(this.localToWorld(pos, rotY, [-0.35, h, -0.05]), rotY + (r() - 0.5) * 0.2);
      else if (r() < 0.7) this.phone(this.localToWorld(pos, rotY, [-0.45, h, -0.15]), rotY + 0.3);
      if (lamp) this.deskLamp(this.localToWorld(pos, rotY, [w / 2 - 0.2, h, -d / 2 + 0.15]), rotY);
    }
  }

  localToWorld(origin, rotY, local) {
    const p = V(local[0], local[1], local[2]).applyAxisAngle(UPV, rotY);
    return [origin[0] + p.x, origin[1] + p.y, origin[2] + p.z];
  }

  chair(pos, rotY = 0, { tipped = false } = {}) {
    // bentwood-style chair: seat, four legs, curved back
    const rot = tipped ? new THREE.Euler(0, rotY, Math.PI / 2 - 0.15) : null;
    const add = (g, mat, local) => {
      if (tipped) {
        const m = new THREE.Matrix4().makeRotationFromEuler(rot);
        m.setPosition(pos[0], pos[1] + 0.24, pos[2]);
        g.translate(local[0], local[1] - 0.24, local[2]);
        this.L.batch.add(prepGeom(g, m, { uv: 'world' }), this.mats.get(mat));
      } else this.geo(g, mat, this.localToWorld(pos, rotY, local), rotY);
    };
    add(new THREE.CylinderGeometry(0.21, 0.2, 0.035, 24), 'planks_dark', [0, 0.45, 0]);
    for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
      const g = new THREE.CylinderGeometry(0.014, 0.012, 0.45, 8);
      g.rotateX(z * 0.12); g.rotateZ(-x * 0.12);
      add(g, 'planks_dark', [x, 0.225, z]);
    }
    const back = new THREE.TorusGeometry(0.17, 0.014, 6, 20, Math.PI);
    add(back, 'planks_dark', [0, 0.78, -0.17]);
    for (const x of [-0.17, 0.17]) add(new THREE.CylinderGeometry(0.013, 0.013, 0.34, 8), 'planks_dark', [x, 0.62, -0.17]);
    const ring = new THREE.TorusGeometry(0.16, 0.008, 6, 24); ring.rotateX(Math.PI / 2);
    add(ring, 'planks_dark', [0, 0.18, 0]);
    if (!tipped) this.collider(this.localToWorld(pos, rotY, [0, 0.25, 0]), [0.2, 0.25, 0.2], rotY);
  }

  bench(pos, rotY = 0, { len = 1.8 } = {}) {
    this.box(pos, rotY, [-len / 2, 0.42, -0.2], [len / 2, 0.46, 0.2], 'planks_oak', { bevel: 0.006 });
    for (const x of [-len / 2 + 0.15, len / 2 - 0.15]) {
      this.box(pos, rotY, [x - 0.03, 0, -0.17], [x + 0.03, 0.42, -0.13], 'paint_black');
      this.box(pos, rotY, [x - 0.03, 0, 0.13], [x + 0.03, 0.42, 0.17], 'paint_black');
      this.box(pos, rotY, [x - 0.03, 0.1, -0.17], [x + 0.03, 0.13, 0.17], 'paint_black');
    }
    this.collider(this.localToWorld(pos, rotY, [0, 0.23, 0]), [len / 2, 0.23, 0.2], rotY);
  }

  cabinet(pos, rotY = 0, { drawers = 4, color = 'paint_sage' } = {}) {
    const h = drawers * 0.33 + 0.06;
    this.box(pos, rotY, [-0.24, 0, -0.32], [0.24, h, 0.32], color, { bevel: 0.01 });
    for (let i = 0; i < drawers; i++) {
      const y = 0.05 + i * 0.33;
      this.box(pos, rotY, [-0.22, y, 0.32], [0.22, y + 0.3, 0.335], color, { bevel: 0.005 });
      this.box(pos, rotY, [-0.06, y + 0.2, 0.335], [0.06, y + 0.225, 0.355], 'brass');
      this.box(pos, rotY, [-0.05, y + 0.12, 0.334], [0.05, y + 0.17, 0.338], this.mats.plain('#e6dcc2', { rough: 0.9 }));
    }
    this.collider(this.localToWorld(pos, rotY, [0, h / 2, 0]), [0.24, h / 2, 0.32], rotY, { kind: 'static', surface: 'metal' });
  }

  // Open shelving of ledgers: varied bindings, heights, a few leaning, labels on spines.
  shelf(pos, rotY = 0, { w = 2.0, h = 2.2, d = 0.4, fill = 0.85, seed = 3 } = {}) {
    const r = rng(seed);
    const levels = Math.round(h / 0.42);
    for (const x of [-w / 2, w / 2]) this.box(pos, rotY, [x - 0.02, 0, -d / 2], [x + 0.02, h, d / 2], 'paint_grey');
    const bindings = ['#4a2c22', '#2d3a32', '#5d4a2c', '#23272c', '#6b3326', '#3c3a33', '#7a6a4a'];
    for (let i = 0; i <= levels; i++) {
      const y = i * (h / levels);
      this.box(pos, rotY, [-w / 2, y, -d / 2], [w / 2, y + 0.025, d / 2], 'paint_grey');
      if (i === levels) break;
      let x = -w / 2 + 0.03;
      while (x < w / 2 - 0.06) {
        if (r() > fill) { x += 0.05 + r() * 0.15; continue; }
        const bw = 0.03 + r() * 0.05, bh = 0.25 + r() * 0.1, bd = 0.24 + r() * 0.08;
        const col = bindings[Math.floor(r() * bindings.length)];
        const lean = r() < 0.06 ? 0.25 : 0;
        const mat = this.mats.plain(col, { rough: 0.75 });
        if (lean) {
          const g = new THREE.BoxGeometry(bw, bh, bd); g.translate(0, bh / 2, 0); g.rotateZ(-lean);
          this.geo(g, mat, this.localToWorld(pos, rotY, [x + bw, y + 0.025, 0]), rotY);
          x += bw + 0.1;
        } else {
          this.box(pos, rotY, [x, y + 0.025, -bd / 2], [x + bw, y + 0.025 + bh, bd / 2], mat);
          if (r() < 0.5) this.box(pos, rotY, [x + 0.004, y + 0.025 + bh * 0.6, bd / 2], [x + bw - 0.004, y + 0.025 + bh * 0.68, bd / 2 + 0.002], this.mats.plain('#d9cfb4', { rough: 0.9 }));
          x += bw + 0.002;
        }
      }
    }
    this.collider(this.localToWorld(pos, rotY, [0, h / 2, 0]), [w / 2, h / 2, d / 2], rotY);
  }

  // cast-iron column radiator under a window or on a wall
  radiator(pos, rotY = 0, { sections = 14, h = 0.7 } = {}) {
    const w = sections * 0.06;
    for (let i = 0; i < sections; i++) {
      const x = -w / 2 + 0.03 + i * 0.06;
      this.box(pos, rotY, [x - 0.022, 0.12, -0.08], [x + 0.022, h, 0.08], 'paint_cream', { bevel: 0.012 });
    }
    this.box(pos, rotY, [-w / 2, 0.16, -0.03], [w / 2, 0.2, 0.03], 'paint_cream');
    this.box(pos, rotY, [-w / 2, h - 0.08, -0.03], [w / 2, h - 0.04, 0.03], 'paint_cream');
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) this.box(pos, rotY, [x - 0.02, 0, -0.05], [x + 0.02, 0.13, 0.05], 'paint_cream');
    this.cyl(pos, rotY, [w / 2 + 0.06, 0.3, 0], 0.016, 0.016, 0.6, 'paint_cream', { seg: 8 });
  }

  // ------------------------------------------------------------------ small things
  mug(pos) {
    const prof = [[0, 0], [0.04, 0], [0.043, 0.004], [0.043, 0.095], [0.038, 0.095], [0.038, 0.008], [0, 0.008]].map(([x, y]) => new THREE.Vector2(x, y));
    this.geo(new THREE.LatheGeometry(prof, 20), this.mats.plain('#e8e2d2', { rough: 0.25 }), pos, 0, { uv: 'keep', shadow: true });
    const handle = new THREE.TorusGeometry(0.025, 0.006, 6, 12, Math.PI); handle.rotateZ(-Math.PI / 2);
    this.geo(handle, this.mats.plain('#e8e2d2', { rough: 0.25 }), [pos[0] + 0.043, pos[1] + 0.05, pos[2]], 0, { uv: 'keep' });
    const coffee = new THREE.CircleGeometry(0.037, 16); coffee.rotateX(-Math.PI / 2);
    this.geo(coffee, this.mats.plain('#2a1a10', { rough: 0.05 }), [pos[0], pos[1] + 0.07, pos[2]], 0, { uv: 'keep', shadow: false });
  }

  paper(pos, rotY = 0, { w = 0.21, d = 0.297 } = {}) {
    const g = new THREE.PlaneGeometry(w, d, 2, 2); g.rotateX(-Math.PI / 2);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) a.setY(i, (Math.abs(a.getX(i)) > 0.05 ? 0.002 : 0) + (a.getZ(i) > 0.1 ? 0.003 : 0));
    g.computeVertexNormals();
    this.geo(g, 'paper', pos, rotY, { uv: 'keep', shadow: false });
  }

  ledger(pos, rotY = 0, { open = false } = {}) {
    if (!open) {
      this.box(pos, rotY, [-0.16, 0, -0.22], [0.16, 0.05, 0.22], this.mats.plain('#4a2c22', { rough: 0.7 }), { bevel: 0.004 });
      this.box(pos, rotY, [-0.155, 0.004, -0.215], [0.15, 0.046, 0.215], this.mats.plain('#e5dcc4', { rough: 0.9 }));
      return;
    }
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.3, 0.02, 0.42);
      g.rotateZ(s * 0.06);
      this.geo(g, this.mats.plain('#e9e1cb', { rough: 0.9 }), this.localToWorld(pos, rotY, [s * 0.155, 0.012, 0]), rotY, { uv: 'keep' });
    }
    // ruled page with entries: a small canvas texture
    const page = this.L.ledgerPageTexture?.() || null;
    if (page) {
      const m = new THREE.MeshStandardMaterial({ map: page, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1 });
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), m);
        p.rotation.x = -Math.PI / 2; p.rotation.z = -rotY;
        const wp = this.localToWorld(pos, rotY, [s * 0.155, 0.0235 + Math.abs(s) * 0.001, 0]);
        p.position.set(wp[0], wp[1], wp[2]);
        p.rotateOnAxis(V(0, 1, 0), s * 0.06);
        this.L.root.add(p);
      }
    }
  }

  typewriter(pos, rotY = 0) {
    this.box(pos, rotY, [-0.19, 0, -0.16], [0.19, 0.09, 0.14], 'paint_black', { bevel: 0.02 });
    this.box(pos, rotY, [-0.17, 0.09, -0.1], [0.17, 0.14, 0.04], 'paint_black', { bevel: 0.015 });
    this.cyl(pos, rotY, [0, 0.16, -0.06], 0.03, 0.03, 0.42, 'bakelite_black', { axis: 'x', seg: 14 });
    for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) this.cyl(pos, rotY, [-0.14 + k * 0.035 + row * 0.01, 0.085 + row * 0.012, 0.09 - row * 0.032], 0.011, 0.011, 0.01, this.mats.plain('#d8d0bc', { rough: 0.4 }), { seg: 8, shadow: false });
    const sheet = new THREE.PlaneGeometry(0.21, 0.18);
    sheet.rotateX(-0.25);
    this.geo(sheet, 'paper', this.localToWorld(pos, rotY, [0, 0.25, -0.09]), rotY, { uv: 'keep', shadow: false });
  }

  phone(pos, rotY = 0) {
    this.box(pos, rotY, [-0.1, 0, -0.12], [0.1, 0.07, 0.1], 'bakelite_black', { bevel: 0.02 });
    this.cyl(pos, rotY, [0, 0.075, 0.03], 0.055, 0.06, 0.01, this.mats.plain('#d6cfc0', { rough: 0.4 }), { seg: 20 });
    const hand = new THREE.CapsuleGeometry(0.022, 0.16, 4, 8); hand.rotateZ(Math.PI / 2);
    this.geo(hand, 'bakelite_black', this.localToWorld(pos, rotY, [0, 0.105, -0.05]), rotY, { uv: 'keep' });
  }

  deskLamp(pos, rotY = 0, { on = true } = {}) {
    this.cyl(pos, rotY, [0, 0.012, 0], 0.07, 0.08, 0.025, 'brass', { seg: 20 });
    this.cyl(pos, rotY, [0, 0.2, 0], 0.008, 0.008, 0.36, 'brass', { seg: 8 });
    const shadeG = new THREE.CylinderGeometry(0.05, 0.11, 0.08, 20, 1, true, 0, Math.PI);
    shadeG.rotateZ(Math.PI / 2); shadeG.rotateX(Math.PI / 2);
    this.geo(shadeG, this.mats.plain('#2f5a3f', { rough: 0.15 }), this.localToWorld(pos, rotY, [0, 0.39, 0.05]), rotY, { uv: 'keep' });
    if (on) {
      const l = new THREE.PointLight('#ffd9a0', 2.2, 3, 2);
      const lp = this.localToWorld(pos, rotY, [0, 0.33, 0.08]);
      l.position.set(lp[0], lp[1], lp[2]);
      this.L.addLight(l, { minor: true });
    }
  }

  coat(pos, rotY = 0) {
    // a coat left on a hook: rounded shoulders, hanging body, a collar
    this.box(pos, rotY, [-0.04, 0.02, -0.02], [0.04, 0.06, 0.04], 'brass');
    const body = new THREE.CylinderGeometry(0.17, 0.26, 0.95, 16, 3, true);
    const a = body.attributes.position;
    for (let i = 0; i < a.count; i++) { const z = a.getZ(i); a.setZ(i, z * 0.45); a.setX(i, a.getX(i) * (1 + Math.sin(a.getY(i) * 9) * 0.02)); }
    body.computeVertexNormals();
    this.geo(body, 'fabric_brown', this.localToWorld(pos, rotY, [0, -0.47, 0.1]), rotY, { uv: 'keep', uvScale: 4 });
    const sh = new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2); sh.scale(1, 0.4, 0.5);
    this.geo(sh, 'fabric_brown', this.localToWorld(pos, rotY, [0, 0.0, 0.1]), rotY, { uv: 'keep', uvScale: 4 });
  }

  clock(pos, rotY = 0, { time = [9, 41], r = 0.17 } = {}) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#efe7d3'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
    x.strokeStyle = INK; x.fillStyle = INK;
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2; const L = i % 5 === 0 ? 16 : 6; x.lineWidth = i % 5 === 0 ? 5 : 2;
      x.beginPath(); x.moveTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); x.lineTo(128 + Math.sin(a) * (116 - L), 128 - Math.cos(a) * (116 - L)); x.stroke();
    }
    x.font = `600 30px ${FONTS.sign}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let h = 1; h <= 12; h++) { const a = h / 12 * Math.PI * 2; x.fillText(String(h), 128 + Math.sin(a) * 86, 128 - Math.cos(a) * 86); }
    const hand = (a, len, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); x.stroke(); };
    hand((time[0] % 12 + time[1] / 60) / 12 * Math.PI * 2, 58, 8);
    hand(time[1] / 60 * Math.PI * 2, 90, 5);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 }));
    const n = V(0, 0, 0.035).applyAxisAngle(UPV, rotY);
    face.position.set(pos[0] + n.x, pos[1], pos[2] + n.z); face.rotation.y = rotY;
    this.L.root.add(face);
    const rim = new THREE.TorusGeometry(r * 0.95, 0.018, 8, 32);
    this.geo(rim, 'paint_black', [pos[0] + n.x * 0.9, pos[1], pos[2] + n.z * 0.9], rotY, { uv: 'keep' });
    const back = new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.03, 32); back.rotateX(Math.PI / 2);
    this.geo(back, 'paint_black', [pos[0] + n.x * 0.45, pos[1], pos[2] + n.z * 0.45], rotY, { uv: 'keep' });
  }

  // wall sign (enamel plate etc.). size in metres
  sign(pos, rotY, lines, { w = 0.9, h = 0.22, style = 'enamel', bg = '#2f4a3f', fg = '#ece4cf', sub = null, px = 1024 } = {}) {
    const t = signTexture(lines, { style, bg, fg, w: px, h: Math.round(px * h / w), sub });
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: style === 'enamel' ? 0.25 : 0.7, metalness: style === 'plate' ? 0.6 : 0, transparent: style === 'stencil', depthWrite: style !== 'stencil', polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    const n = V(0, 0, style === 'stencil' ? 0.004 : 0.012).applyAxisAngle(UPV, rotY);
    mesh.position.set(pos[0] + n.x, pos[1], pos[2] + n.z); mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    this.L.root.add(mesh);
    if (style === 'enamel' || style === 'plate') {
      const b = new THREE.BoxGeometry(w, h, 0.01);
      this.geo(b, 'paint_black', [pos[0] + n.x * 0.4, pos[1], pos[2] + n.z * 0.4], rotY, { uv: 'keep', shadow: false });
    }
    return mesh;
  }

  poster(pos, rotY, kind, { w = 0.6, seed = 1 } = {}) {
    const t = posterTexture(kind, seed);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 720 / 512), m);
    const n = V(0, 0, 0.006).applyAxisAngle(UPV, rotY);
    mesh.position.set(pos[0] + n.x, pos[1], pos[2] + n.z); mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    this.L.root.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------ building services
  pipe(a, b, { r = 0.05, mat = 'paint_green', brackets = true } = {}) {
    const A = V(...a), B = V(...b);
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r, r, len, 14, 1, true);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(UPV, B.clone().sub(A).normalize());
    const m = new THREE.Matrix4().compose(mid, q, V(1, 1, 1));
    this.L.batch.add(prepGeom(g, m, { uv: 'keep', uvScale: 1 }), this.mats.get(mat));
    // flanges every ~2.4 m
    const n = Math.floor(len / 2.4);
    for (let i = 1; i <= n; i++) {
      const p = A.clone().lerp(B, i / (n + 1));
      const f = new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.03, 14);
      this.L.batch.add(prepGeom(f, new THREE.Matrix4().compose(p, q, V(1, 1, 1)), { uv: 'keep' }), this.mats.get(mat));
    }
    if (brackets) void 0;
  }
  pipeRun(points, opts = {}) {
    for (let i = 0; i < points.length - 1; i++) this.pipe(points[i], points[i + 1], opts);
    const r = opts.r || 0.05;
    for (let i = 1; i < points.length - 1; i++) {
      const s = new THREE.SphereGeometry(r * 1.12, 12, 8);
      this.geo(s, opts.mat || 'paint_green', points[i], 0, { uv: 'keep' });
    }
  }

  railing(a, b, { h = 1.0, mat = 'paint_ochre', posts = 1.2, collide = true } = {}) {
    const A = V(...a), B = V(...b);
    const len = A.distanceTo(B);
    const dir = B.clone().sub(A).normalize();
    const rotY = Math.atan2(dir.x, dir.z);
    const n = Math.max(1, Math.round(len / posts));
    for (let i = 0; i <= n; i++) {
      const p = A.clone().lerp(B, i / n);
      this.cyl([p.x, p.y, p.z], 0, [0, h / 2, 0], 0.022, 0.022, h, mat, { seg: 10 });
    }
    for (const y of [h, h * 0.5]) {
      const g = new THREE.CylinderGeometry(0.024, 0.024, len, 10); g.rotateX(Math.PI / 2);
      const mid = A.clone().add(B).multiplyScalar(0.5);
      this.geo(g, mat, [mid.x, mid.y + y, mid.z], rotY, { uv: 'keep' });
    }
    if (collide) {
      const mid = A.clone().add(B).multiplyScalar(0.5);
      this.collider([mid.x, mid.y + h / 2 + 0.25, mid.z], [0.05, h / 2 + 0.25, len / 2], rotY, { kind: 'static', surface: 'metal' });
    }
  }

  // straight stair: from bottom-front-centre `pos`, climbing along rotY direction
  stairs(pos, rotY, { width = 1.4, rise = 0.18, run = 0.3, steps = 8, mat = 'concrete', nosing = 'steel', rails = true } = {}) {
    for (let i = 0; i < steps; i++) {
      const y0 = i * rise, z0 = i * run;
      this.L.solidLocal(pos, rotY, [-width / 2, 0, z0], [width / 2, y0 + rise, z0 + run], mat, { surface: 'stone' });
      if (nosing) this.box(pos, rotY, [-width / 2, y0 + rise - 0.015, z0 - 0.005], [width / 2, y0 + rise + 0.003, z0 + 0.04], nosing);
    }
    if (rails) {
      const a = this.localToWorld(pos, rotY, [width / 2 + 0.05, rise, 0]);
      const b = this.localToWorld(pos, rotY, [width / 2 + 0.05, rise * steps, run * (steps - 1)]);
      this.railing(a, b, { h: 0.9, posts: 1.0, collide: false });
    }
  }

  // an iron ladder (decor only)
  ladder(pos, rotY, h = 3) {
    for (const x of [-0.22, 0.22]) this.box(pos, rotY, [x - 0.02, 0, -0.01], [x + 0.02, h, 0.03], 'paint_black');
    for (let y = 0.3; y < h; y += 0.3) this.cyl(pos, rotY, [0, y, 0.01], 0.012, 0.012, 0.44, 'steel_dark', { axis: 'x', seg: 6 });
  }

  // calibration weight set in a wooden case — set dressing for the theme
  weightSet(pos, rotY = 0) {
    this.box(pos, rotY, [-0.22, 0, -0.14], [0.22, 0.06, 0.14], 'veneer_walnut', { bevel: 0.006 });
    this.box(pos, rotY, [-0.2, 0.06, -0.12], [0.2, 0.062, 0.12], this.mats.plain('#5a2230', { rough: 1 }));
    const sizes = [0.045, 0.036, 0.03, 0.03, 0.024, 0.02, 0.02, 0.016];
    sizes.forEach((r, i) => {
      if (i === 3) return;
      const x = -0.16 + (i % 4) * 0.105, z = i < 4 ? -0.05 : 0.06;
      const h = r * 2.0;
      this.cyl(pos, rotY, [x, 0.062 + h / 2, z], r, r, h, 'brass', { seg: 16 });
      this.cyl(pos, rotY, [x, 0.062 + h + r * 0.35, z], r * 0.45, r * 0.45, r * 0.7, 'brass', { seg: 10 });
    });
  }

  // a decorative two-pan balance on a stand
  balanceScale(pos, rotY = 0, { tilt = 0.08 } = {}) {
    this.cyl(pos, rotY, [0, 0.015, 0], 0.11, 0.13, 0.03, 'veneer_walnut', { seg: 20 });
    this.cyl(pos, rotY, [0, 0.25, 0], 0.012, 0.015, 0.45, 'brass', { seg: 10 });
    const beam = new THREE.BoxGeometry(0.46, 0.012, 0.012); beam.rotateZ(tilt);
    this.geo(beam, 'brass', this.localToWorld(pos, rotY, [0, 0.47, 0]), rotY, { uv: 'keep' });
    for (const s of [-1, 1]) {
      const x = s * 0.22, y = 0.47 + s * Math.sin(tilt) * 0.22 * -1;
      for (const k of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.002, 0.002, 0.18, 4);
        g.rotateZ(k * 0.2);
        this.geo(g, 'brass', this.localToWorld(pos, rotY, [x + k * 0.018, y - 0.09, 0]), rotY, { uv: 'keep', shadow: false });
      }
      const pan = new THREE.SphereGeometry(0.075, 16, 6, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38);
      this.geo(pan, 'brass', this.localToWorld(pos, rotY, [x, y - 0.12, 0]), rotY, { uv: 'keep' });
    }
  }

  // round wall vent grille
  grille(pos, rotY, { w = 0.5, h = 0.3 } = {}) {
    this.box(pos, rotY, [-w / 2, -h / 2, 0], [w / 2, h / 2, 0.015], 'paint_grey', { bevel: 0.005 });
    for (let y = -h / 2 + 0.04; y < h / 2 - 0.02; y += 0.035) this.box(pos, rotY, [-w / 2 + 0.03, y, 0.012], [w / 2 - 0.03, y + 0.012, 0.03], 'paint_black');
  }

  // fuse/switch panel with small dials (dial faces drawn by signs.js elsewhere)
  panel(pos, rotY, { w = 0.6, h = 0.8 } = {}) {
    this.box(pos, rotY, [-w / 2, -h / 2, 0], [w / 2, h / 2, 0.18], 'paint_grey', { bevel: 0.01 });
    for (let i = 0; i < 3; i++) this.cyl(pos, rotY, [-w / 3 + i * w / 3, h / 4, 0.19], 0.05, 0.05, 0.02, 'paint_black', { axis: 'z', seg: 16 });
    for (let i = 0; i < 4; i++) this.box(pos, rotY, [-w / 2 + 0.08 + i * 0.13, -h / 4, 0.18], [-w / 2 + 0.12 + i * 0.13, -h / 4 + 0.08, 0.22], 'bakelite_black');
  }

  barrel(pos, { tipped = false, mat = 'paint_blue' } = {}) {
    const g = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 20, 4);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const y = a.getY(i); const k = 1 + 0.03 * Math.cos(y / 0.44 * Math.PI / 2) ** 2; a.setX(i, a.getX(i) * k); a.setZ(i, a.getZ(i) * k); }
    g.computeVertexNormals();
    if (tipped) { g.rotateZ(Math.PI / 2); this.geo(g, mat, [pos[0], pos[1] + 0.29, pos[2]], this.r() * 3, { uv: 'keep', uvScale: 2 }); this.collider([pos[0], pos[1] + 0.29, pos[2]], [0.44, 0.29, 0.29], 0); }
    else { this.geo(g, mat, [pos[0], pos[1] + 0.44, pos[2]], 0, { uv: 'keep', uvScale: 2 }); this.L.phys.fixedCollider(this.cylDesc(0.44, 0.3, pos), { kind: 'static', surface: 'metal' }); }
  }
  cylDesc(hh, r, pos) {
    const R = this.L.R;
    return R.ColliderDesc.cylinder(hh, r).setTranslation(pos[0], pos[1] + hh, pos[2]);
  }
}
