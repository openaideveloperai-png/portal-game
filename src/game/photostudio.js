// Period photographs (Halde 1948, Agnes at her door 1947, the opening 1951). Each one is
// a small offscreen scene built from the game's own people and buildings, rendered once,
// then "developed" like a print: a red-blind film response, a soft old lens, vignette,
// grain, dust and the odd scratch. The result is cached as a JPEG data URL.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { boxGeom } from '../render/geometry.js';
import { FONTS } from '../render/signs.js';
import { rng } from '../core/util.js';

const PI = Math.PI;
const OUT_W = 720, OUT_H = 520, SS = 1.5;

export function renderPhoto(game, kind) {
  const build = SCENES[kind] || SCENES.halde;
  const st = new Studio(game);
  try {
    const { camera, exposure = 0.6 } = build(st);
    return st.develop(camera, { exposure, seed: 7 + kind.length * 31 });
  } finally {
    st.dispose();
  }
}

const DEVELOP_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uExposure;
varying vec2 vUv;
// orthochromatic-leaning response: reds print dark, skies print pale
float lum(vec2 uv) { return dot(texture2D(tSrc, uv).rgb, vec3(0.17, 0.63, 0.20)); }
void main() {
  vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
  float r2 = dot(d, d);
  // a soft old lens: nearly sharp in the middle, smeared toward the corners
  float rad = (0.75 + r2 * 10.0) / uRes.y;
  float c = lum(vUv) * 0.36;
  c += (lum(vUv + vec2(rad, 0.0)) + lum(vUv - vec2(rad, 0.0)) + lum(vUv + vec2(0.0, rad)) + lum(vUv - vec2(0.0, rad))) * 0.16;
  // halation: bright areas bleed a little into their surroundings
  float glow = 0.0;
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; glow += lum(vUv + vec2(cos(a), sin(a)) * vec2(uRes.y / uRes.x, 1.0) * 6.0 / uRes.y); }
  glow /= 8.0;
  c = (c + max(glow * uExposure - 1.1, 0.0) * 0.25 / max(uExposure, 1e-3)) * uExposure;
  // film shoulder and toe, then a gentle print contrast
  float y = 1.0 - exp(-c * 1.7);
  y = pow(clamp(y, 0.0, 1.0), 0.9);
  y = mix(y, y * y * (3.0 - 2.0 * y), 0.4);
  y *= mix(1.0, 0.7, smoothstep(0.12, 0.8, r2));
  // paper white and the deepest black a fibre print holds
  y = mix(0.05, 0.94, clamp(y, 0.0, 1.0));
  gl_FragColor = vec4(mix(vec3(0.075, 0.068, 0.06), vec3(0.955, 0.94, 0.905), y), 1.0);
}`;

class Studio {
  constructor(game) {
    this.game = game;
    this.mats = game.engine.materials;
    this.chars = game.characters;
    this.scene = new THREE.Scene();
    this.scene.environment = game.engine.envTexture;
    this.scene.environmentIntensity = 0.55;
    this.owned = [];
  }

  m(name, o) { return typeof name === 'string' ? this.mats.get(name, o) : name; }
  plain(c, o) { return this.mats.plain(c, o); }
  own(x) { this.owned.push(x); return x; }
  mesh(geo, mat, { cast = true, receive = true } = {}) {
    this.own(geo);
    const m = new THREE.Mesh(geo, this.m(mat));
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
  box(parent, min, max, mat, { bevel = 0.015, cast = true } = {}) {
    // rubble stone reads better at a finer scale than the game's walls use
    const uvScale = mat === 'stone' ? 2.4 : 1;
    const m = this.mesh(boxGeom(min, max, { bevel, grime: false, uvScale }), mat, { cast });
    parent.add(m);
    return m;
  }
  group(parent, pos = [0, 0, 0], rotY = 0) {
    const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = rotY; parent.add(g); return g;
  }

  // ---------------------------------------------------------------- light and air
  sky({ horizon = 3.4, zenith = 2.2, clouds = 0.25, seed = 1 } = {}) {
    const mat = this.own(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uH: { value: horizon }, uZ: { value: zenith }, uC: { value: clouds }, uS: { value: seed } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uH, uZ, uC, uS; varying vec3 vD;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uS) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float y = max(vD.y, 0.0);
          float b = mix(uH, uZ, pow(y, 0.6));
          vec2 uv = vD.xz / (y + 0.25) * 1.3;
          float c = n(uv) * 0.5 + n(uv * 2.1) * 0.3 + n(uv * 4.3) * 0.2;
          b *= 1.0 - smoothstep(0.45, 0.8, c) * uC;
          gl_FragColor = vec4(vec3(b), 1.0);
        }`,
    }));
    const s = this.mesh(new THREE.SphereGeometry(2500, 32, 16), mat, { cast: false, receive: false });
    s.renderOrder = -10;
    this.scene.add(s);
  }
  sun({ dir, intensity = 3.2, at = [0, 0, 0], area = 30, color = '#fff2dc' }) {
    const l = new THREE.DirectionalLight(color, intensity);
    const d = new THREE.Vector3(...dir).normalize();
    l.position.set(at[0] + d.x * 150, at[1] + d.y * 150, at[2] + d.z * 150);
    l.target.position.set(...at);
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    const c = l.shadow.camera; c.left = -area; c.right = area; c.top = area; c.bottom = -area; c.near = 1; c.far = 400;
    l.shadow.bias = -0.0004; l.shadow.normalBias = 0.03; l.shadow.radius = 2;
    this.scene.add(l, l.target);
    this.sunLight = l;
    return l;
  }
  hemi(sky, ground, i) { this.scene.add(new THREE.HemisphereLight(sky, ground, i)); }
  fog(color, density) { this.scene.fog = new THREE.FogExp2(color, density); }

  // a mottled meadow: blotches of lighter and darker grass
  meadow(seed = 3) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); const r = rng(seed);
    x.fillStyle = '#6c7650'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = r() < 0.5 ? `rgba(40,50,28,${0.08 + r() * 0.12})` : `rgba(150,150,105,${0.06 + r() * 0.1})`;
      x.beginPath(); x.ellipse(r() * 256, r() * 256, 2 + r() * 14, 1 + r() * 6, r() * 3, 0, PI * 2); x.fill();
    }
    const t = this.own(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); t.anisotropy = 8;
    const mat = this.own(new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    const g = this.mesh(new THREE.PlaneGeometry(3000, 3000), mat, { cast: false });
    g.rotation.x = -PI / 2; g.position.y = -0.02;
    this.scene.add(g);
  }
  plane(mat, w, d, pos = [0, 0, 0]) {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    const m = this.mesh(g, mat, { cast: false });
    m.rotation.x = -PI / 2; m.position.set(...pos);
    this.scene.add(m);
    return m;
  }
  // a dirt road through a list of [x, z] points
  road(points, width, mat = 'mud') {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i], [x1, z1] = points[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0) + width * 0.5;
      const g = this.group(this.scene, [(x0 + x1) / 2, 0, (z0 + z1) / 2], Math.atan2(x1 - x0, z1 - z0));
      this.box(g, [-width / 2, -0.02, -len / 2], [width / 2, 0.012 + i * 0.001, len / 2], mat, { bevel: 0, cast: false });
    }
  }
  // valley sides: a ring of slopes with a ragged ridge, forest dark below, paler rock above
  hills({ R = 300, amp = 120, base = 30, seed = 1, depth = 160, forest = '#2c3328', rock = '#7b7f78', centre = [0, 0] }) {
    const seg = 360, rows = 4, pos = [], col = [], idx = [];
    const cf = new THREE.Color(forest), cr = new THREE.Color(rock);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * PI * 2;
      let b = 0, c = 0;
      for (const [f, w] of [[2, 1], [3, 0.7], [5, 0.45], [7, 0.3]]) b += Math.sin(a * f + f * 1.3 + seed) * w;
      for (const [f, w] of [[11, 0.5], [17, 0.34], [26, 0.22], [41, 0.13], [63, 0.07]]) c += Math.pow(1 - Math.abs(Math.sin(a * f + f * 0.7 + seed * 2.3)), 2) * w;
      const env = Math.max(0.05, b / 2.45 * 0.5 + 0.55);
      const top = base + amp * (env * 0.9 + c * env * 0.6);
      for (let k = 0; k <= rows; k++) {
        const t = k / rows;
        const y = -4 + (top + 4) * Math.pow(t, 1.35);
        const rr = R + depth * t;
        pos.push(centre[0] + Math.cos(a) * rr, y, centre[1] + Math.sin(a) * rr);
        const ct = cf.clone().lerp(cr, THREE.MathUtils.smoothstep(y, 25, 110));
        col.push(ct.r, ct.g, ct.b);
      }
      if (i < seg) for (let k = 0; k < rows; k++) {
        const p = i * (rows + 1) + k, q = p + rows + 1;
        idx.push(p, q, p + 1, p + 1, q, q + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mat = this.own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    const m = this.mesh(g, mat, { cast: false });
    this.scene.add(m);
  }

  // ---------------------------------------------------------------- buildings
  // A cottage facing +z: rendered walls on a stone plinth, a gabled roof with eaves,
  // a planked door with a step, small windows with mullions, a chimney.
  cottage(parent, pos, rotY, { w = 7, d = 5.5, h = 3, wall = 'render_white', roof = 'rooftiles_dark', pitch = 0.95, windows = [-2.2, 2.2], door = 0, chimney = 1.6, upper = null } = {}) {
    const g = this.group(parent, pos, rotY);
    this.box(g, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], wall, { bevel: 0.03 });
    this.box(g, [-w / 2 - 0.06, 0, -d / 2 - 0.06], [w / 2 + 0.06, 0.45, d / 2 + 0.06], 'stone', { bevel: 0.02 });
    const r = d / 2 * pitch;
    this.gable(g, w, d, h, r, wall, roof);
    if (chimney !== null) this.box(g, [chimney - 0.32, h + r * 0.3, -0.7], [chimney + 0.32, h + r + 0.85, -0.05], 'brick_red', { bevel: 0.02 });
    if (door !== null) this.door(g, door, d / 2, 0.45);
    for (const x of windows) this.window(g, x, 1.35, d / 2, 0.9, 1.05);
    if (upper) for (const x of upper) this.window(g, x, h + 0.9, d / 2, 0.8, 0.95);
    return g;
  }
  gable(g, w, d, h, r, wall, roof) {
    const tri = new THREE.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, r); tri.closePath();
    const gg = new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false }); gg.translate(0, 0, -w / 2);
    const gm = this.mesh(gg, wall); gm.rotation.y = PI / 2; gm.position.y = h; g.add(gm);
    const ov = 0.42, t = 0.13, th = Math.atan2(r, d / 2);
    const L = (d / 2 + ov) / Math.cos(th);
    for (const s of [1, -1]) {
      const slab = this.mesh(boxGeom([-w / 2 - 0.35, -t / 2, -L / 2], [w / 2 + 0.35, t / 2, L / 2], { grime: false }), roof);
      const zc = (d / 2 + ov) / 2, yc = h + r - zc * Math.tan(th);
      slab.rotation.x = s * th;
      slab.position.set(0, yc + Math.cos(th) * t / 2, s * (zc + Math.sin(th) * t / 2));
      g.add(slab);
    }
    this.box(g, [-w / 2 - 0.35, h + r - 0.02, -0.13], [w / 2 + 0.35, h + r + 0.13, 0.13], roof, { bevel: 0.03 });
  }
  door(g, x, z, sill, { w = 1.0, h = 1.95, open = 0 } = {}) {
    const f = 0.1;
    this.box(g, [x - w / 2 - f, sill, z - 0.02], [x - w / 2, sill + h + f, z + 0.07], 'paint_white');
    this.box(g, [x + w / 2, sill, z - 0.02], [x + w / 2 + f, sill + h + f, z + 0.07], 'paint_white');
    this.box(g, [x - w / 2 - f, sill + h, z - 0.02], [x + w / 2 + f, sill + h + f, z + 0.07], 'paint_white');
    if (open > 0) {
      this.box(g, [x - w / 2 - 0.2, sill, z - 1.3], [x + w / 2 + 0.2, sill + h, z - 1.25], this.plain('#0d0c0b', { rough: 1 }), { cast: false });
      const leaf = this.group(g, [x - w / 2, sill, z - 0.01], open);
      this.box(leaf, [0, 0, -0.05], [w, h, 0], 'planks_dark');
    } else {
      this.box(g, [x - w / 2, sill, z - 0.03], [x + w / 2, sill + h, z + 0.02], 'planks_dark');
    }
    this.box(g, [x - w / 2 - 0.25, 0, z], [x + w / 2 + 0.25, sill, z + 0.55], 'stone', { bevel: 0.02 });
  }
  window(g, x, y, z, w, h) {
    const f = 0.08, glass = this.plain('#1b2125', { rough: 0.1 });
    this.box(g, [x - w / 2, y, z - 0.02], [x + w / 2, y + h, z + 0.01], glass, { bevel: 0, cast: false });
    for (const [a, b] of [[[x - w / 2 - f, y - f], [x - w / 2, y + h + f]], [[x + w / 2, y - f], [x + w / 2 + f, y + h + f]], [[x - w / 2, y + h], [x + w / 2, y + h + f]], [[x - w / 2, y - f], [x + w / 2, y]]]) {
      this.box(g, [a[0], a[1], z - 0.02], [b[0], b[1], z + 0.06], 'paint_white', { bevel: 0.005 });
    }
    this.box(g, [x - 0.025, y, z - 0.01], [x + 0.025, y + h, z + 0.04], 'paint_white', { bevel: 0 });
    this.box(g, [x - w / 2, y + h * 0.55 - 0.025, z - 0.01], [x + w / 2, y + h * 0.55 + 0.025, z + 0.04], 'paint_white', { bevel: 0 });
    this.box(g, [x - w / 2 - 0.12, y - f - 0.05, z - 0.02], [x + w / 2 + 0.12, y - f, z + 0.14], 'stone', { bevel: 0.01 });
  }
  church(parent, pos, rotY) {
    const g = this.group(parent, pos, rotY);
    // nave along x, entrance tower at -x
    const w = 15, d = 8.5, h = 6.8;
    this.box(g, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], 'render_white', { bevel: 0.04 });
    this.gable(g, w, d, h, d / 2 * 1.15, 'render_white', 'rooftiles_dark');
    for (const x of [-3.5, 0, 3.5]) {
      this.box(g, [x - 0.45, 2.2, d / 2 - 0.02], [x + 0.45, 5.4, d / 2 + 0.01], this.plain('#1d2226', { rough: 0.15 }), { bevel: 0, cast: false });
      this.box(g, [x - 0.6, 2.1, d / 2 - 0.02], [x + 0.6, 2.2, d / 2 + 0.12], 'stone', { bevel: 0.01 });
    }
    for (const x of [-5.5, -1.75, 1.75, 5.5]) this.box(g, [x - 0.3, 0, d / 2], [x + 0.3, 4.2, d / 2 + 0.5], 'render_white', { bevel: 0.03 });
    const tx = -w / 2 - 2.1, ts = 4.2, th = 17;
    this.box(g, [tx - ts / 2, 0, -ts / 2], [tx + ts / 2, th, ts / 2], 'render_white', { bevel: 0.04 });
    this.box(g, [tx - ts / 2 - 0.1, th - 0.3, -ts / 2 - 0.1], [tx + ts / 2 + 0.1, th, ts / 2 + 0.1], 'stone', { bevel: 0.02 });
    for (const s of [-1, 1]) this.box(g, [tx - 0.4, th - 3.4, s * (ts / 2) - 0.02], [tx + 0.4, th - 1.2, s * (ts / 2) + 0.02], this.plain('#0e0e0e', { rough: 1 }), { bevel: 0, cast: false });
    const clock = this.mesh(new THREE.CircleGeometry(0.62, 32), this.plain('#d8d2c2', { rough: 0.6 }), { cast: false });
    clock.position.set(tx, th - 5.0, ts / 2 + 0.03); g.add(clock);
    const spire = this.mesh(new THREE.ConeGeometry(ts * 0.74, 9.5, 4, 1), 'rooftiles_dark');
    spire.rotation.y = PI / 4; spire.position.set(tx, th + 4.75, 0); g.add(spire);
    const cross = this.group(g, [tx, th + 9.5, 0]);
    this.box(cross, [-0.04, 0, -0.04], [0.04, 1.3, 0.04], 'steel_dark', { bevel: 0 });
    this.box(cross, [-0.04, 0.75, -0.35], [0.04, 0.83, 0.35], 'steel_dark', { bevel: 0 });
    this.door(g, tx, ts / 2, 0, { w: 1.3, h: 2.6 });
    return g;
  }
  spruce(parent, x, z, hgt, seed = 1) {
    const r = rng(seed);
    const mat = this.plain('#28302a', { rough: 1 });
    const g = this.group(parent, [x, 0, z], r() * PI);
    const trunk = this.mesh(new THREE.CylinderGeometry(0.1 * hgt / 10, 0.22 * hgt / 10, hgt * 0.35, 6), this.plain('#3a3027', { rough: 1 }));
    trunk.position.y = hgt * 0.17; g.add(trunk);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = i / n, rad = hgt * (0.3 - t * 0.22) * (0.9 + r() * 0.2), hh = hgt * 0.36;
      const c = this.mesh(new THREE.ConeGeometry(rad, hh, 7, 1), mat);
      c.position.y = hgt * 0.18 + t * hgt * 0.7 + hh / 2; c.rotation.y = r() * PI; g.add(c);
    }
  }
  broadleaf(parent, x, z, hgt, seed = 1) {
    const r = rng(seed);
    const g = this.group(parent, [x, 0, z]);
    const trunk = this.mesh(new THREE.CylinderGeometry(0.12, 0.2, hgt * 0.5, 6), this.plain('#3b342c', { rough: 1 }));
    trunk.position.y = hgt * 0.25; g.add(trunk);
    const mat = this.own(new THREE.MeshStandardMaterial({ color: '#4a573e', roughness: 1, flatShading: true }));
    for (let i = 0; i < 16; i++) {
      const s = hgt * (0.1 + r() * 0.07);
      const a = r() * PI * 2, rr = r() * hgt * 0.26;
      const b = this.mesh(new THREE.IcosahedronGeometry(s, 0), mat);
      b.position.set(Math.cos(a) * rr, hgt * (0.5 + r() * 0.42), Math.sin(a) * rr); b.rotation.set(r() * 3, r() * 3, 0); g.add(b);
    }
  }
  pole(parent, x, z, hgt = 7.5) {
    const g = this.group(parent, [x, 0, z]);
    const p = this.mesh(new THREE.CylinderGeometry(0.09, 0.13, hgt, 8), 'planks_grey'); p.position.y = hgt / 2; g.add(p);
    this.box(g, [-0.75, hgt - 0.55, -0.06], [0.75, hgt - 0.43, 0.06], 'planks_grey', { bevel: 0 });
    return [[x - 0.6, hgt - 0.38, z], [x + 0.6, hgt - 0.38, z]];
  }
  wire(a, b, sag = 0.5) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t));
    }
    const m = this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), this.plain('#1a1a1a', { rough: 0.6 }), { cast: false });
    this.scene.add(m);
  }
  fence(parent, a, b, step = 2.4) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = this.group(parent, [a[0], 0, a[1]], Math.atan2(b[0] - a[0], b[1] - a[1]));
    for (let s = 0; s <= len; s += step) this.box(g, [-0.05, 0, s - 0.05], [0.05, 1.15, s + 0.05], 'planks_grey', { bevel: 0 });
    for (const y of [0.45, 0.95]) this.box(g, [-0.03, y, 0], [0.03, y + 0.09, len], 'planks_grey', { bevel: 0 });
  }
  // raised bronze letters on a facade
  lettering(parent, lines, pos, width, height) {
    const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * height / width);
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach(([text, size], i) => {
      let fs = c.height * size;
      const fit = () => { x.font = `600 ${fs}px ${FONTS.sign}`; if (x.letterSpacing !== undefined) x.letterSpacing = `${fs * 0.12}px`; return x.measureText(text).width; };
      const tw = fit();
      if (tw > c.width * 0.96) { fs *= c.width * 0.96 / tw; fit(); }
      const y = c.height * (lines.length === 1 ? 0.5 : 0.32 + i * 0.46);
      x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillText(text, c.width / 2 + fs * 0.05, y + fs * 0.07);
      x.fillStyle = '#3a3128'; x.fillText(text, c.width / 2, y);
    });
    const t = this.own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const mat = this.own(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.45, metalness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const m = this.mesh(new THREE.PlaneGeometry(width, height), mat, { cast: false });
    m.position.set(...pos); parent.add(m);
  }

  // ---------------------------------------------------------------- people
  person(spec, pos, yaw, clip = 'Idle_Loop', t = 0) {
    const h = this.chars.makeHuman(spec);
    h.root.position.set(...pos); h.root.rotation.y = yaw;
    const c = this.chars.clip(clip) || this.chars.clip('Idle_Loop');
    if (c) { const a = h.mixer.clipAction(c); a.play(); h.mixer.setTime(Math.min(t, c.duration - 0.01)); }
    h.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(h.root);
    h.root.updateMatrixWorld(true);
    (this.people ||= []).push(h);
    return h;
  }

  // ---------------------------------------------------------------- the darkroom
  develop(camera, { exposure, seed }) {
    const r = this.game.engine.renderer;
    const W = Math.round(OUT_W * SS), H = Math.round(OUT_H * SS);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const prevTarget = r.getRenderTarget(), prevAuto = r.autoClear, prevShadow = r.shadowMap.enabled;
    const mats = new Set();
    this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => mats.add(m)); });
    // shadows matter in daylight; turn them on for this one exposure if the quality preset has them off
    if (!prevShadow) { r.shadowMap.enabled = true; mats.forEach(m => { m.needsUpdate = true; }); }
    r.shadowMap.needsUpdate = true;
    const hdr = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const ldr = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType });
    const quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: hdr.texture }, uRes: { value: new THREE.Vector2(W, H) }, uExposure: { value: exposure } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: DEVELOP_FRAG, depthTest: false, depthWrite: false,
    }));
    const px = new Uint8Array(W * H * 4);
    try {
      r.autoClear = true;
      r.setRenderTarget(hdr); r.clear(); r.render(this.scene, camera);
      r.setRenderTarget(ldr); r.clear(); quad.render(r);
      r.readRenderTargetPixels(ldr, 0, 0, W, H, px);
    } finally {
      r.setRenderTarget(prevTarget); r.autoClear = prevAuto;
      if (!prevShadow) { r.shadowMap.enabled = false; mats.forEach(m => { m.needsUpdate = true; }); }
      hdr.dispose(); ldr.dispose(); quad.material.dispose(); quad.dispose();
    }
    // GL rows run bottom-up
    const big = document.createElement('canvas'); big.width = W; big.height = H;
    const bx = big.getContext('2d');
    const id = bx.createImageData(W, H);
    for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    bx.putImageData(id, 0, 0);
    const c = document.createElement('canvas'); c.width = OUT_W; c.height = OUT_H;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(big, 0, 0, OUT_W, OUT_H);
    this.age(x, OUT_W, OUT_H, rng(seed));
    return c.toDataURL('image/jpeg', 0.86);
  }
  // grain, uneven development, dust and scratches
  age(x, W, H, r) {
    const id = x.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] / 255;
      const amp = 16 * (0.45 + 0.55 * 4 * v * (1 - v));
      const n = (r() + r() + r() - 1.5) * amp;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    x.putImageData(id, 0, 0);
    for (let i = 0; i < 3; i++) {
      const g = x.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, W * (0.2 + r() * 0.3));
      const a = 0.03 + r() * 0.04, lite = r() < 0.5;
      g.addColorStop(0, lite ? `rgba(255,250,235,${a})` : `rgba(40,30,20,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    // dust on the negative prints white; a few dark specks from the print itself
    for (let i = 0; i < 45; i++) {
      x.fillStyle = r() < 0.8 ? `rgba(250,246,236,${0.4 + r() * 0.5})` : `rgba(20,16,12,${0.3 + r() * 0.4})`;
      x.beginPath(); x.arc(r() * W, r() * H, 0.4 + r() * 1.2, 0, PI * 2); x.fill();
    }
    x.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      x.strokeStyle = `rgba(250,246,236,${0.25 + r() * 0.35})`; x.lineWidth = 0.6 + r() * 0.6;
      const sx = r() * W, sy = r() * H, len = 6 + r() * 26, a = r() * PI * 2;
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + Math.cos(a + 1) * len * 0.5, sy + Math.sin(a + 1) * len * 0.5, sx + Math.cos(a) * len, sy + Math.sin(a) * len); x.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const sx = r() * W;
      x.strokeStyle = `rgba(245,240,228,${0.08 + r() * 0.1})`; x.lineWidth = 0.7;
      x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + (r() - 0.5) * 30, H); x.stroke();
    }
  }

  dispose() {
    for (const h of this.people || []) this.chars.forget(h);
    for (const o of this.owned) o.dispose?.();
    this.owned = [];
    this.scene.clear();
  }
}

// ---------------------------------------------------------------- the photographs
const VILLAGER_F = { name: 'villager', body: 'f', skin: 'light', outfit: 'village_f', hair: 'buns', hairColor: '#3a2e25', grey: 0.1, age: 0.6 };
const VILLAGER_M = { name: 'villager', body: 'm', skin: 'light', outfit: 'village_m', hair: 'buzzed', hairColor: '#4a3b2e', grey: 0.2, age: 0.7, beard: true };

const SCENES = {
  // "Halde from the south road, summer 1948. The church, the schoolhouse, our house."
  halde(st) {
    const S = st.scene;
    st.fog('#d5d8d6', 0.0048);
    st.sky({ horizon: 3.6, zenith: 2.4, clouds: 0.22, seed: 2 });
    st.sun({ dir: [-0.6, 0.85, 0.42], intensity: 3.3, at: [-2, 0, -48], area: 75 });
    st.hemi('#e6ecef', '#6a6a55', 1.15);
    st.meadow(5);
    st.road([[0.6, 6], [0, -16], [-2.2, -34], [-4.5, -52], [-5, -70], [-4, -100]], 4.2, st.m('mud', { tint: '#c2b597' }));
    st.hills({ R: 330, amp: 120, base: 40, seed: 2.2, depth: 180 });
    st.hills({ R: 760, amp: 200, base: 90, seed: 5.1, depth: 200, forest: '#55605a', rock: '#9a9e99' });
    // the village
    st.church(S, [-14, 0, -76], 0.12);
    st.cottage(S, [-1.5, 0, -64], 0.18, { w: 7.5, d: 5.8, wall: 'render_white', windows: [-2.3, 2.3], door: 0 });                          // our house
    st.cottage(S, [17, 0, -47], -0.32, { w: 16, d: 8, h: 6.4, wall: 'render_ochre', windows: [-6, -3.6, 3.6, 6], upper: [-6, -3.6, -1.2, 1.2, 3.6, 6], door: 0, chimney: -4, pitch: 0.7 }); // the schoolhouse
    st.cottage(S, [-12.5, 0, -24], 0.42, { w: 7, d: 5.4, wall: 'render_white', windows: [-2, 2.2], door: 0.1, chimney: -1.4 });
    st.cottage(S, [10.5, 0, -22], -0.5, { w: 8.5, d: 6.5, h: 3.4, wall: 'planks_grey', roof: 'rooftiles', windows: [2.4], door: -1.5, chimney: null });
    st.cottage(S, [-25, 0, -44], 0.2, { w: 7, d: 5.4, wall: 'render_rose', windows: [-2, 2], door: 0 });
    st.cottage(S, [27, 0, -78], -0.15, { w: 7.5, d: 5.6, wall: 'render_white', windows: [-2.2, 2.2], door: 0 });
    st.cottage(S, [9, 0, -96], 0.06, { w: 7, d: 5.4, wall: 'render_ochre', windows: [-2, 2], door: 0 });
    st.cottage(S, [-33, 0, -88], 0.3, { w: 9, d: 6.5, h: 3.6, wall: 'planks_grey', roof: 'rooftiles', windows: [], door: 0, chimney: null });
    st.cottage(S, [16, 0, -122], -0.1, { w: 7, d: 5.4, windows: [-2, 2], door: 0 });
    st.cottage(S, [-6, 0, -128], 0.12, { w: 7, d: 5.4, wall: 'render_rose', windows: [-2, 2], door: 0 });
    st.fence(S, [-3.1, 3], [-3.6, -18]);
    st.fence(S, [-8.5, -19], [-6, -30]);
    // telegraph line along the road
    const poles = [[3.6, -3], [3.4, -33], [1.6, -63], [1.4, -93]].map(([x, z]) => st.pole(S, x, z));
    for (let i = 0; i < poles.length - 1; i++) for (const k of [0, 1]) st.wire(poles[i][k], poles[i + 1][k], 0.55);
    // trees: spruce on the slopes, a few broadleaf trees in the village
    const r = rng(11);
    for (let i = 0; i < 70; i++) {
      const a = -PI / 2 + (r() - 0.5) * 2.2, d = 150 + r() * 120;
      st.spruce(S, Math.cos(a) * d, Math.sin(a) * d, 12 + r() * 10, i);
    }
    for (const [x, z, h] of [[-22, -60, 9], [-30, -26, 10], [24, -100, 9], [-9, -95, 8], [36, -55, 10], [8, -66, 8]]) st.broadleaf(S, x, z, h, x * 7 + z);
    for (const [x, z] of [[-40, -38], [-44, -48], [40, -32], [46, -42], [42, -70]]) st.spruce(S, x, z, 13, x - z);
    // two people on the road
    st.person(VILLAGER_F, [-0.9, 0, -13], PI + 0.08, 'Walk_Loop', 0.45);
    st.person(VILLAGER_M, [-2.4, 0, -6.8], 0.55, 'Idle_Loop', 1.3);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
    cam.position.set(1.4, 1.62, 3.5); cam.lookAt(-3, 4.6, -60);
    return { camera: cam, exposure: 1.45 };
  },

  // "Mama at the door of the house by the church, 1947."
  agnes(st) {
    const S = st.scene;
    st.fog('#d8dad8', 0.006);
    st.sky({ horizon: 3.4, zenith: 2.4, clouds: 0.2, seed: 4 });
    st.sun({ dir: [-0.45, 0.95, 0.85], intensity: 3.2, at: [0, 0, 0], area: 14 });
    st.hemi('#e6ecef', '#6a655a', 1.1);
    st.plane('cobbles', 60, 60, [0, 0, 10]);
    st.meadow(9);
    // the house: whitewashed front at z = 0 with the door, a window, the corner at x = 1.65
    const g = st.group(S, [0, 0, 0]);
    const H = 2.85;
    st.box(g, [-7, 0, -6], [-0.62, H, 0], 'render_white', { bevel: 0.03 });
    st.box(g, [0.62, 0, -6], [1.65, H, 0], 'render_white', { bevel: 0.03 });
    st.box(g, [-0.62, 2.1, -6], [0.62, H, 0], 'render_white', { bevel: 0.03 });
    st.box(g, [-7, 0, -6], [1.7, 0.4, 0.06], 'stone', { bevel: 0.02 });
    st.box(g, [-7.2, H, -6.2], [1.95, H + 0.14, 0.22], 'planks_dark', { bevel: 0.01 });
    st.door(g, 0, 0, 0.12, { w: 1.0, h: 1.98, open: 1.15 });
    st.window(g, -1.75, 1.0, 0, 0.85, 1.0);
    // the barrel by the door, and a bench
    const barrel = st.group(S, [-0.98, 0, 0.42]);
    const staves = st.mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.82, 18, 1), 'planks_oak'); staves.position.y = 0.41; barrel.add(staves);
    for (const y of [0.12, 0.7]) { const hoop = st.mesh(new THREE.TorusGeometry(0.297, 0.012, 4, 24), 'steel_dark'); hoop.rotation.x = PI / 2; hoop.position.y = y; barrel.add(hoop); }
    const lid = st.mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.03, 18), 'planks_dark'); lid.position.y = 0.83; barrel.add(lid);
    const bench = st.group(S, [1.05, 0, 0.32]);
    st.box(bench, [-0.4, 0.42, -0.16], [0.4, 0.47, 0.16], 'planks_oak', { bevel: 0.005 });
    for (const s of [-1, 1]) st.box(bench, [s * 0.33 - 0.03, 0, -0.14], [s * 0.33 + 0.03, 0.42, 0.14], 'planks_oak', { bevel: 0 });
    // beyond the corner: the churchyard wall, a wooden cross, the side of the church
    st.box(S, [1.7, 0, -3.4], [12, 1.1, -2.9], 'stone', { bevel: 0.03 });
    const cross = st.group(S, [3.4, 0, -4.4], 0.2);
    st.box(cross, [-0.04, 0, -0.04], [0.04, 1.45, 0.04], 'planks_grey', { bevel: 0 });
    st.box(cross, [-0.32, 1.0, -0.035], [0.32, 1.08, 0.035], 'planks_grey', { bevel: 0 });
    st.church(S, [14, 0, -17], 0);
    st.broadleaf(S, 7.5, -8.5, 7, 3);
    st.spruce(S, 16, -24, 14, 8);
    st.hills({ R: 260, amp: 110, base: 40, seed: 1.4, depth: 150 });
    st.person({ name: 'agnes', body: 'f', skin: 'light', outfit: 'agnes', hair: 'buns', hairColor: '#3d3027', grey: 0.3, age: 1, posture: 0.04 }, [0.04, 0.12, 0.36], 0.14, 'Idle_FoldArms_Loop', 0.9);
    const cam = new THREE.PerspectiveCamera(38, 1, 0.05, 4000);
    cam.position.set(0.6, 1.42, 4.6); cam.lookAt(0.12, 1.25, 0);
    return { camera: cam, exposure: 1.5 };
  },

  // "Opening of the Institute, 14 May 1951. O.V. second from left."
  opening(st) {
    const S = st.scene;
    st.fog('#d6d8d8', 0.004);
    st.sky({ horizon: 3.5, zenith: 2.5, clouds: 0.3, seed: 7 });
    st.sun({ dir: [-0.5, 0.82, 0.68], intensity: 3.2, at: [0, 0, 2], area: 18 });
    st.hemi('#e6ecef', '#6d675c', 1.1);
    st.plane('slab_ext', 80, 60, [0, 0, 10]);
    const g = st.group(S, [0, 0, 0]);
    // the facade: render between stone pilasters, two rows of tall windows, a stone portal
    st.box(g, [-15, 0, -14], [15, 10, 0], st.m('render_white', { grime: 0, macro: 0.04 }), { bevel: 0.04 });
    st.box(g, [-15.2, 0, -14.2], [15.2, 0.6, 0.12], 'stone', { bevel: 0.02 });
    for (const x of [-12.5, -8.6, -4.7, 4.7, 8.6, 12.5]) st.box(g, [x - 0.38, 0, 0], [x + 0.38, 9.2, 0.32], 'concrete_ext', { bevel: 0.02 });
    st.box(g, [-15.3, 9.2, -0.2], [15.3, 9.9, 0.6], 'concrete_ext', { bevel: 0.03 });
    for (const x of [-10.55, -6.65, 6.65, 10.55]) { st.window(g, x - 0.85, 1.5, 0, 1.15, 2.4); st.window(g, x + 0.85, 1.5, 0, 1.15, 2.4); st.window(g, x - 0.85, 5.6, 0, 1.15, 2.2); st.window(g, x + 0.85, 5.6, 0, 1.15, 2.2); }
    for (const x of [-2.6, 2.6]) st.window(g, x, 5.6, 0, 1.15, 2.2);
    const pf = 'concrete_ext';
    st.box(g, [-2.1, 0, 0], [-1.45, 4.3, 0.55], pf, { bevel: 0.02 });
    st.box(g, [1.45, 0, 0], [2.1, 4.3, 0.55], pf, { bevel: 0.02 });
    st.box(g, [-2.1, 3.75, 0], [2.1, 4.3, 0.55], pf, { bevel: 0.02 });
    st.box(g, [-1.45, 0, -0.3], [1.45, 3.75, -0.25], st.plain('#16191b', { rough: 0.12 }), { bevel: 0, cast: false });
    for (const x of [-0.725, 0.725]) { st.box(g, [x - 0.03, 0, -0.25], [x + 0.03, 3.75, -0.2], 'brass', { bevel: 0 }); }
    st.box(g, [-1.45, 0, -0.25], [1.45, 0.25, -0.2], 'brass', { bevel: 0 });
    st.lettering(g, [['STATE INSTITUTE OF PONDERAL MEASURES', 0.42], ['KALDEN', 0.3]], [0, 4.95, 0.03], 7.6, 1.0);
    // steps up to the door
    for (let i = 0; i < 3; i++) st.box(g, [-3.4 + i * 0.3, 0, 0], [3.4 - i * 0.3, 0.16 * (i + 1), 1.9 - i * 0.55], 'slab_ext', { bevel: 0.02 });
    // flagpoles with plain flags hanging still
    for (const x of [-6.6, 6.6]) {
      const p = st.mesh(new THREE.CylinderGeometry(0.05, 0.07, 9.5, 10), 'paint_white'); p.position.set(x, 4.75, 2.4); S.add(p);
      const fg = new THREE.PlaneGeometry(1.0, 2.2, 6, 12); const fp = fg.attributes.position;
      for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(fp.getX(i) * 9 + fp.getY(i) * 0.5) * 0.05);
      fg.computeVertexNormals();
      const flag = st.mesh(fg, st.plain('#7a2a22', { rough: 0.9, side: THREE.DoubleSide })); flag.position.set(x + (x < 0 ? 0.55 : -0.55), 8.1, 2.4); S.add(flag);
      const band = st.mesh(new THREE.PlaneGeometry(1.0, 0.5), st.plain('#d8d0bc', { rough: 0.9, side: THREE.DoubleSide })); band.position.set(flag.position.x, 7.55, 2.43); S.add(band);
    }
    st.hills({ R: 220, amp: 140, base: 60, seed: 3.3, depth: 160 });
    // the line-up, left to right
    const people = [
      [{ name: 'official', body: 'm', skin: 'light', outfit: 'official', hair: 'parted', hairColor: '#5a5048', grey: 0.6, belly: 0.08, age: 1 }, -2.5, 0.08, 'Idle_Loop', 0.2],
      [{ name: 'varga1951', body: 'f', skin: 'light', outfit: 'varga', hair: 'parted', hairColor: '#2f251d', grey: 0, glasses: true, age: 0 }, -1.48, 0.1, 'Idle_Loop', 1.4],
      [{ name: 'minister', body: 'm', skin: 'light', outfit: 'official', hair: 'parted', hairColor: '#8e877d', grey: 0.8, belly: 0.16, age: 1 }, -0.45, -0.04, 'Idle_Talking_Loop', 1.0],
      [{ name: 'deputy', body: 'f', skin: 'light', outfit: 'official_f', hair: 'buns', hairColor: '#2b211b', grey: 0.15, age: 0.6 }, 0.55, -0.1, 'Idle_Loop', 2.3],
      [{ name: 'engineer', body: 'm', skin: 'light', outfit: 'tech', hair: 'parted', hairColor: '#3b3028', glasses: true, age: 0.5 }, 1.58, -0.12, 'Idle_FoldArms_Loop', 0.6],
    ];
    for (const [spec, x, yaw, clip, t] of people) st.person(spec, [x, 0, 3.4], yaw, clip, t);
    // a young caretaker, a little apart, looking at something else
    st.person({ name: 'brask1951', body: 'm', skin: 'light', outfit: 'brask', hair: 'parted', hairColor: '#4a3a2c', grey: 0, age: 0 }, [2.75, 0, 2.85], -0.6, 'Idle_Loop', 0.9);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
    cam.position.set(0.15, 1.45, 9.6); cam.lookAt(0.15, 2.55, 0);
    return { camera: cam, exposure: 1.45 };
  },
};
