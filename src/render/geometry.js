// Geometry helpers: chamfered boxes with world-projected UVs, wall splitting around
// openings, and a static batcher that merges all level geometry per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

const _m = new THREE.Matrix4();
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();

// Box-project UVs from world position (metres) by dominant normal axis.
export function worldUV(geom, { scale = 1, offset = [0, 0] } = {}) {
  const pos = geom.attributes.position, nor = geom.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z * Math.sign(nor.getX(i) || 1); v = y; }
    else { u = -x * Math.sign(nor.getZ(i) || 1); v = y; }
    uv[i * 2] = u * scale + offset[0]; uv[i * 2 + 1] = v * scale + offset[1];
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

export function setGrime(geom, base, top) {
  const n = geom.attributes.position.count;
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { a[i * 2] = base; a[i * 2 + 1] = top; }
  geom.setAttribute('grimeRange', new THREE.BufferAttribute(a, 2));
  return geom;
}

// Plain box from min/max corners, non-indexed, in world space.
function plainBox(sx, sy, sz) {
  return new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
}

const _chamferCache = new Map();
function chamferBox(sx, sy, sz, b) {
  b = Math.min(b, sx * 0.45, sy * 0.45, sz * 0.45);
  const key = `${sx.toFixed(4)},${sy.toFixed(4)},${sz.toFixed(4)},${b.toFixed(4)}`;
  if (_chamferCache.has(key)) return _chamferCache.get(key).clone();
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const pts = [];
  for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-1, 1]) {
    pts.push(new THREE.Vector3(X * (hx - b), Y * hy, Z * (hz - b)));
    pts.push(new THREE.Vector3(X * hx, Y * (hy - b), Z * (hz - b)));
    pts.push(new THREE.Vector3(X * (hx - b), Y * (hy - b), Z * hz));
  }
  const g = new ConvexGeometry(pts);
  g.deleteAttribute('uv');
  _chamferCache.set(key, g);
  return g.clone();
}

// Box geometry in world space.
// opts: bevel (m), rotY (rad), rot (Euler), grime: [base, top] | false, uvScale
export function boxGeom(min, max, opts = {}) {
  const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
  const g = opts.bevel ? chamferBox(sx, sy, sz, opts.bevel) : plainBox(sx, sy, sz);
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  _m.identity();
  if (opts.rot) _m.makeRotationFromEuler(opts.rot);
  else if (opts.rotY) _m.makeRotationY(opts.rotY);
  _m.setPosition(c[0], c[1], c[2]);
  g.applyMatrix4(_m);
  worldUV(g, { scale: opts.uvScale ?? 1, offset: opts.uvOffset });
  const gr = opts.grime === false ? [0, 0] : (opts.grime || [min[1], max[1]]);
  setGrime(g, gr[0], gr[1]);
  return g;
}

// Take any geometry (local), place it with a matrix, give it world UVs (or keep its own)
// and a grime range, and return a non-indexed copy ready for batching.
export function prepGeom(src, matrix, { uv = 'world', uvScale = 1, grime = null } = {}) {
  let g = src.index ? src.toNonIndexed() : src.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  if (uv === 'world' || !g.attributes.uv) worldUV(g, { scale: uvScale });
  else if (uvScale !== 1) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uvScale, a.getY(i) * uvScale); }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const gr = grime === false ? [0, 0] : (grime || [bb.min.y, bb.max.y]);
  setGrime(g, gr[0], gr[1]);
  return g;
}

// Split a wall rectangle [a0,a1] x [y0,y1] around rectangular openings.
// Returns a list of [a0, a1, y0, y1] solid pieces.
export function splitWall(a0, a1, y0, y1, openings = []) {
  const ops = openings.map(o => [Math.max(a0, o[0]), Math.min(a1, o[1]), Math.max(y0, o[2]), Math.min(y1, o[3])])
    .filter(o => o[1] > o[0] + 1e-4 && o[3] > o[2] + 1e-4);
  if (!ops.length) return [[a0, a1, y0, y1]];
  const xs = new Set([a0, a1]);
  for (const o of ops) { xs.add(o[0]); xs.add(o[1]); }
  const cuts = [...xs].sort((p, q) => p - q);
  const pieces = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s0 = cuts[i], s1 = cuts[i + 1];
    if (s1 - s0 < 1e-4) continue;
    const mid = (s0 + s1) / 2;
    const holes = ops.filter(o => o[0] <= mid && o[1] >= mid).map(o => [o[2], o[3]]).sort((p, q) => p[0] - q[0]);
    let y = y0;
    for (const [h0, h1] of holes) { if (h0 > y + 1e-4) pieces.push([s0, s1, y, h0]); y = Math.max(y, h1); }
    if (y1 > y + 1e-4) pieces.push([s0, s1, y, y1]);
  }
  // merge vertically-identical neighbours to keep piece count low
  const merged = [];
  for (const p of pieces) {
    const prev = merged.find(m => Math.abs(m[1] - p[0]) < 1e-5 && Math.abs(m[2] - p[2]) < 1e-5 && Math.abs(m[3] - p[3]) < 1e-5);
    if (prev) prev[1] = p[1]; else merged.push([...p]);
  }
  return merged;
}

// Collects geometry per material and merges into single meshes.
export class StaticBatch {
  constructor() { this.groups = new Map(); }
  add(geom, material, { castShadow = true, receiveShadow = true } = {}) {
    const key = material.uuid + (castShadow ? 's' : 'n');
    if (!this.groups.has(key)) this.groups.set(key, { material, geoms: [], castShadow, receiveShadow });
    this.groups.get(key).geoms.push(geom);
  }
  build(parent) {
    const meshes = [];
    for (const { material, geoms, castShadow, receiveShadow } of this.groups.values()) {
      // all geometries must share the same attribute set
      for (const g of geoms) {
        if (!g.attributes.grimeRange) setGrime(g, 0, 0);
        if (!g.attributes.uv) worldUV(g);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'grimeRange'].includes(k)) g.deleteAttribute(k);
        if (g.index) g.setIndex(null);
      }
      const merged = mergeGeometries(geoms, false);
      for (const g of geoms) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

// Lathe / tube helpers for props.
export function cylinderGeom(r0, r1, h, seg = 16, open = false) {
  return new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
}

export const tmpMatrix = (pos, rotY = 0, scale = 1, rot = null) => {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  if (rot) q.setFromEuler(rot); else q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  m.compose(new THREE.Vector3(pos[0], pos[1], pos[2]), q, typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale));
  return m;
};
export { _n, _p };
