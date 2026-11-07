// Exteriors: night sky, mountain silhouettes, the reservoir, the town's lights in the
// valley, rain that only falls outdoors, and lightning.
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { audio } from '../core/audio.js';

export function buildExterior(L, { rainBox = null, water = -14, town = true, mountains = true, moon = true, rain = true, waterExtent = 900, seed = 3, townDir = 1, dawn = false } = {}) {
  const root = new THREE.Group();
  L.root.add(root);
  const out = { root };
  // sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uDawn: { value: dawn ? 1 : 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      uniform float uTime, uFlash, uDawn; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= .5; } return s; }
      void main(){
        float y = vDir.y;
        vec3 horizon = vec3(0.075, 0.08, 0.085), zenith = vec3(0.012, 0.014, 0.02);
        vec3 c = mix(horizon, zenith, smoothstep(-0.05, 0.6, y));
        vec2 uv = vDir.xz / (abs(y) + 0.35);
        float cl = fbm(uv * 1.6 + vec2(uTime * 0.012, 0.0));
        float mask = smoothstep(0.35, 0.8, cl) * smoothstep(-0.02, 0.25, y);
        c = mix(c, vec3(0.11, 0.115, 0.12), mask * 0.75);
        vec3 md = normalize(vec3(-0.5, 0.42, -0.75));
        float m = max(dot(normalize(vDir), md), 0.0);
        c += vec3(0.25, 0.26, 0.28) * pow(m, 60.0) * (1.0 - mask * 0.85);
        c += vec3(0.05, 0.05, 0.055) * pow(m, 6.0);
        c = mix(c, vec3(0.06, 0.055, 0.05), smoothstep(0.05, -0.2, y));
        c += uFlash * vec3(0.5, 0.52, 0.6) * (0.4 + mask);
        // dawn: a cold clear sky warming at the eastern horizon
        vec3 dz = mix(vec3(0.62, 0.55, 0.50), vec3(0.30, 0.38, 0.48), smoothstep(-0.02, 0.5, y));
        float east = pow(max(dot(normalize(vDir.xz + 1e-4), normalize(vec2(1.0, 0.25))), 0.0), 3.0);
        dz += vec3(0.55, 0.30, 0.12) * east * (1.0 - smoothstep(0.0, 0.35, y));
        dz = mix(dz, vec3(0.70, 0.66, 0.62), mask * 0.35);
        dz = mix(dz, vec3(0.20, 0.19, 0.18), smoothstep(0.05, -0.2, y));
        c = mix(c, dz, uDawn);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  root.add(sky);
  out.sky = sky; out.skyMat = skyMat;
  const r = rng(seed);
  // mountains: a ring with a noisy ridge line, very dark, softened by fog
  if (mountains) {
    const seg = 220, R = 900;
    const pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2;
      let hgt = 0;
      for (let k = 1; k <= 6; k++) hgt += Math.sin(a * k * 3 + r() * 6) * (180 / k) * (0.6 + r() * 0.5);
      hgt = 40 + Math.abs(hgt) * 0.45 + (Math.cos(a) * 0.5 + 0.5) * 60;
      pos.push(Math.cos(a) * R, -60, Math.sin(a) * R, Math.cos(a) * R, hgt, Math.sin(a) * R);
      if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: dawn ? '#3a4048' : '#0a0c0e', side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false;
    root.add(m);
  }
  // the reservoir
  if (water !== null) {
    const tex = L.game.engine.materials.texgen.get('ripple', { tint: '#ffffff', size: 512 });
    const g = new THREE.PlaneGeometry(waterExtent * 2, waterExtent * 2, 1, 1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * waterExtent / 6, uv.getY(i) * waterExtent / 6);
    const wm = new THREE.MeshStandardMaterial({ color: '#0d1414', roughness: 0.08, metalness: 0.2, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.2 });
    const w = new THREE.Mesh(g, wm);
    w.rotation.x = -Math.PI / 2; w.position.y = water; w.receiveShadow = true;
    root.add(w);
    out.water = w; out.waterTex = tex.normalMap;
  }
  // town lights far below the dam
  if (town) {
    const N = 900; const p = new Float32Array(N * 3); const c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const cluster = r() < 0.7;
      const ang = (cluster ? 0.15 * (r() - 0.5) : 0.6 * (r() - 0.5)) + (townDir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const d = cluster ? 260 + r() * 180 : 150 + r() * 650;
      p[i * 3] = Math.cos(ang) * d * 0.4 + (r() - 0.5) * 140; p[i * 3 + 1] = -120 + r() * 8; p[i * 3 + 2] = Math.sin(ang) * d;
      const warm = r() < 0.8;
      c.set(warm ? [1.0, 0.72 + r() * 0.1, 0.42] : [0.75, 0.85, 1.0], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    pts.frustumCulled = false;
    root.add(pts);
  }
  // rain
  if (rain) {
    const N = 6000, H = 22, S = 26;
    const p = new Float32Array(N * 2 * 3); const off = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * S * 2, y = r() * H, z = (r() - 0.5) * S * 2, sp = 9 + r() * 4;
      for (let k = 0; k < 2; k++) { p.set([x, y, z], (i * 2 + k) * 3); off.set([x, y, z, k * 0.32 + sp * 0.0001], (i * 2 + k) * 4); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(off, 4));
    const box = rainBox || [-1e4, -1e4, -1e4, 1e4, 1e4, 1e4];
    const rm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBoxMin: { value: new THREE.Vector3(box[0], box[1], box[2]) }, uBoxMax: { value: new THREE.Vector3(box[3], box[4], box[5]) }, uFlash: { value: 0 } },
      vertexShader: `
        attribute vec4 seed; uniform float uTime; uniform vec3 uCam; varying float vA; varying vec3 vW;
        void main(){
          float sp = 11.0;
          float y = mod(seed.y - uTime * sp, 22.0);
          vec3 p = vec3(seed.x, y - 9.0, seed.z);
          p.x += (y - 11.0) * 0.08; p.y -= seed.w > 0.1 ? 0.32 : 0.0; p.x -= seed.w > 0.1 ? 0.025 : 0.0;
          p.xz = mod(p.xz - uCam.xz + 26.0, 52.0) - 26.0 + uCam.xz;
          p.y += uCam.y;
          vW = p;
          vA = 1.0 - smoothstep(10.0, 26.0, length(p.xz - uCam.xz));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uBoxMin, uBoxMax; uniform float uFlash; varying float vA; varying vec3 vW;
        void main(){
          if (any(lessThan(vW, uBoxMin)) || any(greaterThan(vW, uBoxMax))) discard;
          gl_FragColor = vec4(vec3(0.62, 0.66, 0.7) + uFlash, 0.22 * vA);
        }`,
    });
    const lines = new THREE.LineSegments(g, rm);
    lines.frustumCulled = false;
    root.add(lines);
    out.rain = rm;
  }
  // lightning
  out.flash = 0; out.nextFlash = 6 + r() * 10;
  L.onUpdate(dt => {
    const t = L.game.engine.time;
    skyMat.uniforms.uTime.value = t;
    if (out.rain) { out.rain.uniforms.uTime.value = t; out.rain.uniforms.uCam.value.copy(L.game.engine.camera.position); }
    if (out.waterTex) out.waterTex.offset.set(t * 0.01, t * 0.006);
    out.nextFlash -= dt;
    if (out.nextFlash < 0 && out.lightning !== false) {
      out.flash = 1; out.nextFlash = 12 + Math.random() * 22;
      setTimeout(() => audio.play('thunder'), 700 + Math.random() * 2500);
    }
    out.flash = Math.max(0, out.flash - dt * 3.5);
    const f = out.flash > 0.6 ? 1 : out.flash > 0.3 ? 0.2 : out.flash > 0.15 ? 0.7 : 0;
    skyMat.uniforms.uFlash.value = f * 0.8;
    if (out.rain) out.rain.uniforms.uFlash.value = f * 0.3;
    const post = L.game.engine.post.uniforms;
    if (post) post.uFlash.value = f * 0.06;
  });
  L.onDispose = () => { const post = L.game.engine.post.uniforms; if (post) post.uFlash.value = 0; };
  return out;
}
