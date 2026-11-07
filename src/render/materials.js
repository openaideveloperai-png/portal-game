// Material library. Surfaces get their base textures from TexGen and then a
// world-space "history" layer injected into MeshStandardMaterial:
//   * large-scale colour drift so no two metres of wall are identical,
//   * grime that collects where walls meet floors (driven by a per-vertex range),
//   * faint water streaks running down from ceilings and ledges,
//   * puddles on floors when a level is wet.
import * as THREE from 'three';
import { TexGen } from './texgen.js';

// Shared uniforms all world materials read (set per level / per frame).
export const WORLD = {
  uWet: { value: 0 },
  uTime: { value: 0 },
  uGrimeAll: { value: 1 },
};

// Palette: picked from period references (1950s–70s public works, institute interiors)
// rather than from defaults. Kept deliberately muted; colour comes from light.
export const PRESETS = {
  terrazzo: { type: 'terrazzo', tint: '#cdc4b0' },
  terrazzo_dark: { type: 'terrazzo', tint: '#8f8a80', seed: 3 },
  tile_cream: { type: 'tiles', tint: '#e2d7bd', tint2: '#8d877b' },
  tile_green: { type: 'tiles', tint: '#93a98f', tint2: '#76786d', seed: 2 },
  tile_ox: { type: 'tiles', tint: '#9a4b36', tint2: '#6d665d', seed: 5 },
  tile_white: { type: 'tiles', tint: '#e9e6dc', tint2: '#9b978d', seed: 7 },
  plaster_cream: { type: 'plaster', tint: '#e4dccb' },
  plaster_green: { type: 'plaster', tint: '#b6c2a6', seed: 2 },
  plaster_ochre: { type: 'plaster', tint: '#d6bf8e', seed: 3 },
  plaster_grey: { type: 'plaster', tint: '#bdbab2', seed: 4 },
  plaster_blue: { type: 'plaster', tint: '#a9b5b6', seed: 6 },
  concrete: { type: 'concrete', tint: '#9c978d' },
  concrete_dark: { type: 'concrete', tint: '#6f6b65', seed: 2 },
  concrete_wet: { type: 'concrete', tint: '#7a766e', seed: 4 },
  slab: { type: 'slab', tint: '#8f8b84' },
  slab_dark: { type: 'slab', tint: '#6b6863', seed: 2 },
  lino_oxblood: { type: 'lino', tint: '#7a3b2d', tint2: '#9a5a40' },
  lino_green: { type: 'lino', tint: '#55705a', tint2: '#78907a', seed: 2 },
  lino_ochre: { type: 'lino', tint: '#a8823f', tint2: '#c49d58', seed: 3 },
  lino_grey: { type: 'lino', tint: '#6e6c66', tint2: '#8e8b83', seed: 4 },
  planks_oak: { type: 'planks', tint: '#a07a4e' },
  planks_dark: { type: 'planks', tint: '#6b4b2e', seed: 2 },
  planks_grey: { type: 'planks', tint: '#7d766b', seed: 3 },
  veneer_oak: { type: 'veneer', tint: '#946d44' },
  veneer_walnut: { type: 'veneer', tint: '#5e4029', seed: 2 },
  paint_green: { type: 'paint', tint: '#4b6a57', param: 0.4 },
  paint_sage: { type: 'paint', tint: '#8d9f86', param: 0.3, seed: 2 },
  paint_cream: { type: 'paint', tint: '#d8cdb2', param: 0.3, seed: 3 },
  paint_grey: { type: 'paint', tint: '#6f716d', param: 0.45, seed: 4 },
  paint_red: { type: 'paint', tint: '#8e3526', param: 0.5, seed: 5 },
  paint_ochre: { type: 'paint', tint: '#c39a3c', param: 0.55, seed: 6 },
  paint_black: { type: 'paint', tint: '#262523', param: 0.35, seed: 7 },
  paint_blue: { type: 'paint', tint: '#3f5867', param: 0.45, seed: 8 },
  paint_white: { type: 'paint', tint: '#e2ded3', param: 0.25, seed: 9 },
  steel: { type: 'steel', tint: '#bcbab5' },
  steel_dark: { type: 'steel', tint: '#6b6a67', seed: 2 },
  rust: { type: 'rust', tint: '#ffffff' },
  brass: { type: 'brass', tint: '#ffffff' },
  copper: { type: 'brass', tint: '#e0a28a', seed: 3 },
  rubber: { type: 'rubber', tint: '#2a2826' },
  grating: { type: 'grating', tint: '#6f6c66', alphaTest: 0.5, side: THREE.DoubleSide },
  stone: { type: 'stone', tint: '#ffffff' },
  stone_dark: { type: 'stone', tint: '#8a8a88', seed: 2 },
  render_white: { type: 'render', tint: '#ddd6c6' },
  render_ochre: { type: 'render', tint: '#cfb27a', seed: 2 },
  render_rose: { type: 'render', tint: '#c9a08e', seed: 3 },
  rooftiles: { type: 'rooftiles', tint: '#9a5236' },
  rooftiles_dark: { type: 'rooftiles', tint: '#5e4b40', seed: 2 },
  brick_red: { type: 'brick', tint: '#8c4632' },
  brick_yellow: { type: 'brick', tint: '#b59a6a', seed: 2 },
  cobbles: { type: 'cobbles', tint: '#8a8780' },
  mud: { type: 'mud', tint: '#5a5146' },
  wiredglass: { type: 'wiredglass', tint: '#cfd8d2', transparent: true, side: THREE.DoubleSide },
  bakelite: { type: 'bakelite', tint: '#4a2a1d' },
  bakelite_black: { type: 'bakelite', tint: '#1c1a19', seed: 2 },
  leather: { type: 'leather', tint: '#5b3a24' },
  leather_black: { type: 'leather', tint: '#272220', seed: 2 },
  fabric_navy: { type: 'fabric', tint: '#2f3a4a' },
  fabric_brown: { type: 'fabric', tint: '#5b4634', seed: 2 },
  fabric_green: { type: 'fabric', tint: '#4b5a46', seed: 3 },
  fabric_grey: { type: 'fabric', tint: '#77746d', seed: 4 },
  fabric_red: { type: 'fabric', tint: '#7a2f27', seed: 5 },
  paper: { type: 'paper', tint: '#e9e1cc' },
};

const NOISE = /* glsl */`
float tare_h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float tare_n3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tare_h31(i), tare_h31(i + vec3(1,0,0)), f.x), mix(tare_h31(i + vec3(0,1,0)), tare_h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tare_h31(i + vec3(0,0,1)), tare_h31(i + vec3(1,0,1)), f.x), mix(tare_h31(i + vec3(0,1,1)), tare_h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float tare_f3(vec3 x) { return tare_n3(x) * 0.6 + tare_n3(x * 2.03 + 7.1) * 0.3 + tare_n3(x * 4.1 + 1.3) * 0.1; }
`;

function injectHistory(shader, mat) {
  const u = mat.userData.history;
  shader.uniforms.uMacro = u.uMacro;
  shader.uniforms.uGrime = u.uGrime;
  shader.uniforms.uWetAmt = u.uWetAmt;
  shader.uniforms.uWet = WORLD.uWet;
  shader.uniforms.uGrimeAll = WORLD.uGrimeAll;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec2 grimeRange;
varying vec3 vTWPos; varying vec3 vTWNorm; varying vec2 vTGrime;`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vTWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTWNorm = normalize(mat3(modelMatrix) * objectNormal);
vTGrime = grimeRange;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform float uMacro; uniform float uGrime; uniform float uWet; uniform float uWetAmt; uniform float uGrimeAll;
varying vec3 vTWPos; varying vec3 vTWNorm; varying vec2 vTGrime;
${NOISE}`)
    .replace('#include <map_fragment>', `#include <map_fragment>
float tGrimeR = 0.0; float tWetR = 0.0;
{
  float mN = tare_f3(vTWPos * 0.42);
  diffuseColor.rgb *= 1.0 + (mN - 0.5) * uMacro;
  float g = 0.0;
  float gAmt = uGrime * uGrimeAll;
  if (abs(vTWNorm.y) < 0.6 && vTGrime.y > vTGrime.x + 0.01) {
    float hb = vTWPos.y - vTGrime.x;
    float n2 = tare_f3(vTWPos * vec3(2.6, 1.2, 2.6));
    float bottom = 1.0 - smoothstep(0.0, 0.18 + 0.4 * n2, hb);
    float ht = vTGrime.y - vTWPos.y;
    float sn = tare_n3(vec3((vTWPos.x + vTWPos.z) * 6.5, vTWPos.y * 0.3, 3.7));
    float streak = smoothstep(0.62, 0.9, sn) * (1.0 - smoothstep(0.0, 2.2 + n2, ht));
    g = clamp(bottom * 0.6 + streak * 0.35, 0.0, 1.0) * gAmt;
  } else if (vTWNorm.y > 0.6) {
    float fd = smoothstep(0.5, 0.85, tare_f3(vTWPos * 0.55 + 3.0));
    g = fd * 0.35 * gAmt;
    float pud = smoothstep(0.58, 0.64, tare_f3(vTWPos * vec3(0.7, 0.0, 0.7) + 11.0)) * uWet * uWetAmt;
    tWetR = pud;
    diffuseColor.rgb *= 1.0 - pud * 0.35;
  }
  diffuseColor.rgb *= 1.0 - g * 0.45;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.88, 0.80), g * 0.6);
  tGrimeR = g;
}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 1.0, tGrimeR * 0.45);
roughnessFactor = mix(roughnessFactor, 0.04, tWetR);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, uWet * uWetAmt * 0.5);`);
}

export class Materials {
  constructor(renderer, { texSize = 1024 } = {}) {
    this.texgen = new TexGen(renderer, { size: texSize });
    this.cache = new Map();
    this.envMap = null;
  }

  // name: preset key, or { type, tint, ... } object, with optional overrides.
  get(name, overrides = {}) {
    const key = typeof name === 'string' ? name + JSON.stringify(overrides) : JSON.stringify(name) + JSON.stringify(overrides);
    if (this.cache.has(key)) return this.cache.get(key);
    const spec = Object.assign({}, typeof name === 'string' ? PRESETS[name] : name, overrides);
    if (!spec.type) throw new Error('unknown material preset: ' + name);
    const tex = this.texgen.get(spec.type, { tint: spec.tint || '#ffffff', tint2: spec.tint2 || '#808080', seed: spec.seed || 1, param: spec.param ?? 0.5, size: spec.size });
    const rep = 1 / tex.world;
    for (const t of [tex.map, tex.normalMap, tex.ormMap]) t.repeat.set(rep, rep);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.ormMap, metalnessMap: tex.ormMap, aoMap: tex.ormMap,
      roughness: 1, metalness: 1, aoMapIntensity: 0.9,
      transparent: !!spec.transparent, alphaTest: spec.alphaTest || 0, side: spec.side ?? THREE.FrontSide,
      envMapIntensity: spec.envMapIntensity ?? 1,
    });
    if (spec.transparent) { mat.depthWrite = false; }
    mat.name = typeof name === 'string' ? name : spec.type;
    mat.userData.history = {
      uMacro: { value: spec.macro ?? 0.16 },
      uGrime: { value: spec.grime ?? 1 },
      uWetAmt: { value: spec.wet ?? 1 },
    };
    mat.onBeforeCompile = shader => injectHistory(shader, mat);
    mat.customProgramCacheKey = () => 'tare-history';
    this.cache.set(key, mat);
    return mat;
  }

  // Unlit/emissive surface for lamp tubes, bulbs, dial lamps.
  emissive(color = '#ffe7c2', intensity = 3) {
    const key = 'emit' + color + intensity;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
    this.cache.set(key, m);
    return m;
  }

  plain(color, { rough = 0.6, metal = 0, emissive = null, ei = 1, transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
    const key = `plain${color}${rough}${metal}${emissive}${ei}${transparent}${opacity}${side}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, transparent, opacity, side });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
    if (transparent) m.depthWrite = false;
    this.cache.set(key, m);
    return m;
  }

  glass({ tint = '#c8d2cc', opacity = 0.16 } = {}) {
    const key = 'glass' + tint + opacity;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.04, metalness: 0.0, transparent: true, opacity, depthWrite: false, envMapIntensity: 1.6 });
    this.cache.set(key, m);
    return m;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
    this.texgen.dispose();
  }
}
