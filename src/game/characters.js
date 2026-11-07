// People. Bodies, hair and animation are CC0 assets by Quaternius (human-authored
// meshes with correct anatomy and hand-keyed animation). On load each character is
// reshaped and dressed procedurally:
//   * muscles under clothing are smoothed away, cloth thickness is added, an older
//     man gets a belly, posture is adjusted per character;
//   * clothing is painted straight into the body's texture on the GPU in UV space —
//     seams, buttons, collars, belts, pressed creases, knit ribbing, worn leather;
//   * hair is rebound to the body's skeleton and greyed; glasses and coat tails are
//     built and skinned to the same skeleton.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { R, GROUPS } from '../core/physics.js';
import { Weighted, Drum } from './weights.js';
import { UNIT_MASS } from './player.js';
import { damp, clamp, rng } from '../core/util.js';

const BASE = './assets/models/';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Rest-pose landmarks measured from the meshes (metres, Y up, facing +Z, left = +X).
const LM = {
  m: { waist: 1.0, collar: 1.49, neck: 1.52, wrist: 0.69, elbow: 0.463, shoulder: 0.212, knee: 0.542, ankle: 0.115, hip: 0.114, chest: 1.33, armY: 1.455, eyeY: 1.70, eyeZ: 0.075, headTop: 1.81 },
  f: { waist: 0.985, collar: 1.455, neck: 1.485, wrist: 0.625, elbow: 0.392, shoulder: 0.152, knee: 0.535, ankle: 0.105, hip: 0.111, chest: 1.31, armY: 1.418, eyeY: 1.656, eyeZ: 0.062, headTop: 1.767 },
};

const BONE_GROUPS = {
  torso: ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'],
  upper: ['upperarm_l', 'upperarm_r'],
  lower: ['lowerarm_l', 'lowerarm_r'],
  thigh: ['thigh_l', 'thigh_r'],
  calf: ['calf_l', 'calf_r'],
  foot: ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'ball_leaf_l', 'ball_leaf_r'],
  head: ['neck_01', 'Head'],
};

// ------------------------------------------------------------------ outfits
// Colours are sRGB hex. Each outfit is interpreted by the bake shader below.
export const OUTFITS = {
  // Teodor Brask: collarless work shirt, sleeves rolled, knitted vest, wool trousers, boots
  brask: { top: '#a9b2ad', topKind: 1, sleeves: 'rolled', vest: '#55613f', bottom: '#655a4a', shoes: '#2e241d', belt: '#4a3020', buttons: true, collar: 0, pocket: true },
  // Ottilie Varga: long lab coat over a dark dress, stockings, low shoes, watch
  varga: { top: '#d6cfbc', topKind: 2, sleeves: 'long', coat: true, under: '#2e2c35', bottom: '#2e2c35', legs: '#4a403a', shoes: '#211b18', buttons: true, collar: 1, watch: true, pocket: true },
  // a technician in a brown warehouse coat (photos, background)
  tech: { top: '#6e5a3e', topKind: 2, sleeves: 'long', coat: true, under: '#3a3a38', bottom: '#3a3a38', shoes: '#211c18', buttons: true, collar: 1, pocket: true },
  // a 1940s villager (photographs of Halde)
  village_f: { top: '#3a3430', topKind: 0, sleeves: 'long', bottom: '#3a3430', dress: true, apron: '#cfc6b0', legs: '#4a403a', shoes: '#1f1a17', buttons: true, collar: 1 },
  village_m: { top: '#d8cfba', topKind: 1, sleeves: 'rolled', vest: '#2f2c2a', bottom: '#3d3833', shoes: '#241e19', belt: '#2b1d14', buttons: true, collar: 0 },
  // Agnes Varga, 1947: dark dress, stockings, a work apron
  agnes: { top: '#34302d', topKind: 0, sleeves: 'long', bottom: '#34302d', dress: true, apron: '#9d9584', legs: '#3f3733', shoes: '#1f1a17', buttons: true, collar: 1 },
  // Ministry people at the opening, 1951: dark overcoats
  official: { top: '#2b2b2f', topKind: 2, sleeves: 'long', coat: true, under: '#1d1d21', bottom: '#29292d', shoes: '#151312', buttons: true, collar: 1, pocket: true },
  official_f: { top: '#3a393e', topKind: 2, sleeves: 'long', coat: true, under: '#26252a', bottom: '#2c2b30', legs: '#4a403a', shoes: '#1a1716', buttons: true, collar: 1 },
  // the auditor's sleeve and glove (first-person)
  auditor: { top: '#323a48', topKind: 0, sleeves: 'long', coat: true, bottom: '#2c3340', shoes: '#1d1a18', gloves: '#7a5638', buttons: false, collar: 1 },
};

const hex = h => new THREE.Color(h).convertSRGBToLinear();

const BAKE_VERT = /* glsl */`
attribute vec3 rpos; attribute vec3 rnorm; attribute vec4 mA; attribute vec4 mB;
varying vec3 vP; varying vec3 vN; varying vec2 vUv; varying vec4 vA; varying vec4 vB;
void main() { vP = rpos; vN = normalize(rnorm); vUv = uv; vA = mA; vB = mB; gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0); }`;

const BAKE_FRAG = /* glsl */`
uniform sampler2D tSkin, tSkinN, tSkinR;
uniform int uMode;
uniform vec3 cTop, cVest, cBottom, cLegs, cShoes, cBelt, cGlove, cApron, cUnder;
uniform float uVest, uBelt, uGlove, uButtons, uCoat, uDress, uApron, uWatch, uRolled, uLegs, uPocket, uCollar, uTopKind;
uniform float lWaist, lCollar, lNeck, lWrist, lElbow, lShoulder, lKnee, lAnkle, lChest, lArmY, lEyeY, uAge;
varying vec3 vP; varying vec3 vN; varying vec2 vUv; varying vec4 vA; varying vec4 vB;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n3(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { return n3(p) * 0.55 + n3(p * 2.1 + 3.1) * 0.3 + n3(p * 4.3 + 7.7) * 0.15; }
float line(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
void main() {
  vec3 P = vP; float y = P.y; float ax = abs(P.x);
  float torso = vA.x, upper = vA.y, lower = vA.z, hand = vA.w;
  float thigh = vB.x, calf = vB.y, foot = vB.z, head = vB.w;
  bool armZone = (upper + lower + hand) > 0.5 || (ax > lShoulder + 0.05 && y > lArmY - 0.16);
  bool isHand = armZone && ax > (uGlove > 0.5 ? lWrist + 0.012 : lWrist - 0.005);
  bool isHead = !armZone && (head > 0.5 || y > lNeck + 0.02) && y > lCollar - 0.02;
  bool isFoot = (foot > 0.5 || y < lAnkle) && !armZone;
  bool isLeg = !isFoot && !armZone && y < lWaist;
  float sleeveEnd = uRolled > 0.5 ? (lElbow + 0.06) : (uGlove > 0.5 ? lWrist + 0.012 : lWrist - 0.01);
  bool isSleeve = armZone && !isHand && ax < sleeveEnd;
  bool isForearm = armZone && !isHand && !isSleeve;
  bool isTop = (!armZone && !isHead && !isLeg && !isFoot) || isSleeve;

  vec3 skin = texture2D(tSkin, vUv).rgb;
  vec3 skinN = texture2D(tSkinN, vUv).rgb;
  float skinR = texture2D(tSkinR, vUv).r;
  vec3 col = skin; vec3 nrm = skinN; float rough = skinR; float metal = 0.0; float cloth = 0.0;
  float grain = fbm(P * 140.0);
  float mott = fbm(P * 9.0);

  if (isTop) {
    cloth = 1.0;
    col = cTop * (0.9 + 0.16 * mott) * (0.96 + 0.08 * grain);
    if (uTopKind < 0.5) col *= 0.97 + 0.06 * sin(P.y * 900.0 + n3(P * 40.0) * 3.0);
    float front = smoothstep(0.02, 0.08, P.z);
    // collar band
    if (!armZone) {
      float cb = smoothstep(lCollar - 0.05, lCollar - 0.035, y);
      col *= 1.0 - cb * 0.12; col += cb * 0.02;
      // buttons and placket down the front
      if (uButtons > 0.5 && front > 0.5 && y > lWaist + 0.03 && y < lCollar - 0.06) {
        float pl = line(P.x - 0.012, 0.004);
        col *= 1.0 - pl * 0.25;
        float by = mod(y - lWaist, 0.085) - 0.042;
        float b = 1.0 - smoothstep(0.005, 0.0075, length(vec2(P.x, by)));
        col = mix(col, vec3(0.86, 0.83, 0.76), b * (1.0 - uCoat * 0.6));
        col = mix(col, vec3(0.20, 0.17, 0.14), b * uCoat * 0.6);
        rough = mix(rough, 0.3, b);
      }
      // breast pocket on the left chest
      if (uPocket > 0.5 && front > 0.5) {
        vec2 q = vec2(P.x - 0.085, y - (lChest + 0.02));
        float edge = max(abs(q.x) - 0.045, abs(q.y) - 0.05);
        col *= 1.0 - line(edge, 0.004) * 0.3;
        col *= 1.0 - (1.0 - smoothstep(-0.002, 0.004, abs(q.y - 0.045) - 0.0)) * step(abs(q.x), 0.045) * 0.15;
      }
      // soft folds gathering at the waist and under the arms
      float fold = sin(P.x * 70.0 + n3(P * 12.0) * 4.0) * smoothstep(lWaist + 0.18, lWaist, y);
      col *= 1.0 - max(fold, 0.0) * 0.08;
      float pit = smoothstep(lShoulder - 0.02, lShoulder + 0.04, ax) * smoothstep(lArmY - 0.25, lArmY - 0.1, y);
      col *= 1.0 - pit * 0.18;
    }
    if (isSleeve) {
      // elbow creases and the cuff
      float ec = sin((ax - lElbow) * 160.0) * exp(-pow((ax - lElbow) * 18.0, 2.0));
      col *= 1.0 - max(ec, 0.0) * 0.18;
      float cuff = smoothstep(sleeveEnd - (uRolled > 0.5 ? 0.06 : 0.04), sleeveEnd - 0.005, ax);
      col *= 1.0 - cuff * 0.1;
      col *= 1.0 - line(ax - (sleeveEnd - (uRolled > 0.5 ? 0.06 : 0.04)), 0.003) * 0.3;
      // under-arm seam
      col *= 1.0 - line(P.y - (lArmY - 0.045), 0.004) * 0.25 * step(P.z, 0.0);
    }
    // knitted vest over the shirt
    if (uVest > 0.5 && !armZone && y > lWaist - 0.06) {
      float vline = (lCollar - 0.1);
      bool vneck = P.z > 0.0 && y > vline && ax < (y - vline) * 0.55;
      bool arm = ax > lShoulder + 0.01 && y > lArmY - 0.11;
      if (!vneck && !arm && y < lCollar - 0.02) {
        float ang = atan(P.x, P.z);
        float rib = 0.5 + 0.5 * sin(ang * 140.0);
        col = cVest * (0.85 + 0.2 * rib) * (0.92 + 0.12 * mott);
        float hem = smoothstep(lWaist + 0.0, lWaist - 0.04, y);
        col *= 1.0 - hem * 0.08 * sin(ang * 300.0);
        rough = 0.95;
      }
    }
  }
  if (isLeg) {
    cloth = 1.0;
    vec3 c = cBottom;
    col = c * (0.88 + 0.16 * mott) * (0.95 + 0.08 * grain);
    // under a long coat the thighs take the coat colour so nothing dark shows through
    if (uCoat > 0.5 && y > lKnee - 0.03) col = cTop * (0.86 + 0.14 * mott);
    // dress/skirt: hem below the knee, stockings under it
    else if (uDress > 0.5 && y < lKnee - 0.04) col = cLegs * (0.9 + 0.1 * grain);
    else if (uLegs > 0.5 && y < lKnee + 0.18) col = cLegs * (0.9 + 0.12 * grain);
    else {
      // trousers: outer seam, pressed front crease, knee bagging, turn-ups
      float outer = line(abs(vN.x) - 1.0, 0.12) * step(0.0, P.x * vN.x);
      col *= 1.0 - outer * 0.12;
      float crease = smoothstep(0.96, 0.995, vN.z);
      col *= 1.0 + crease * 0.07;
      float kn = exp(-pow((y - lKnee) * 14.0, 2.0)) * smoothstep(0.0, 0.05, -P.z + 0.02);
      col *= 1.0 - kn * 0.12 * (0.5 + 0.5 * sin(P.x * 120.0));
      float cuff = smoothstep(lAnkle + 0.06, lAnkle + 0.045, y);
      col *= 1.0 - cuff * 0.08;
      col *= 1.0 - line(y - (lAnkle + 0.055), 0.004) * 0.3;
      // fly and crotch folds
      float fly = line(P.x, 0.006) * smoothstep(lWaist, lWaist - 0.02, y) * smoothstep(lWaist - 0.2, lWaist - 0.17, y) * step(0.0, P.z);
      col *= 1.0 - fly * 0.25;
    }
    // apron
    if (uApron > 0.5 && P.z > 0.02 && y > lKnee + 0.05 && ax < 0.17) col = cApron * (0.9 + 0.12 * mott);
  }
  // dress continues above the waist as the top when requested
  // belt
  if (uBelt > 0.5 && !armZone && abs(y - (lWaist + 0.005)) < 0.022) {
    col = cBelt * (0.8 + 0.3 * grain); rough = 0.5; cloth = 1.0;
    vec2 bq = vec2(P.x, y - (lWaist + 0.005));
    float buckle = step(max(abs(bq.x) - 0.028, abs(bq.y) - 0.02), 0.0) * step(0.03, P.z);
    float hole = step(max(abs(bq.x) - 0.02, abs(bq.y) - 0.012), 0.0);
    if (buckle > 0.5) { col = mix(vec3(0.62, 0.5, 0.3), col, hole); metal = 1.0 - hole; rough = 0.35; }
  }
  if (isFoot) {
    cloth = 1.0;
    col = cShoes * (0.85 + 0.25 * mott);
    rough = 0.42 + 0.2 * grain;
    float sole = smoothstep(0.03, 0.018, y);
    col = mix(col, vec3(0.06, 0.05, 0.05), sole);
    rough = mix(rough, 0.8, sole);
    // laces over the instep
    if (P.z > 0.03 && y > 0.05 && y < lAnkle && abs(P.x - sign(P.x) * 0.11) < 0.03) {
      float lc = line(mod(y, 0.018) - 0.009, 0.003);
      col = mix(col, vec3(0.12, 0.1, 0.09), lc * 0.8);
    }
    col *= 1.0 - line(y - 0.032, 0.003) * 0.4;
  }
  if (isHand && uGlove > 0.5) {
    cloth = 1.0;
    col = cGlove * (0.82 + 0.3 * mott) * (0.95 + 0.1 * grain);
    rough = 0.5 + 0.15 * grain;
    float seam = line(fract(ax * 40.0) - 0.5, 0.05) * 0.0;
    col *= 1.0 - seam;
    float wristBand = smoothstep(lWrist + 0.03, lWrist + 0.01, ax);
    col *= 1.0 - wristBand * 0.15;
  }
  // a wristwatch on the left wrist
  if (uWatch > 0.5 && armZone && P.x > 0.0 && abs(ax - (lWrist - 0.02)) < 0.011) {
    float face = step(0.0, P.y - lArmY + 0.0) * step(abs(P.z + 0.06), 0.022);
    col = mix(vec3(0.12, 0.09, 0.07), vec3(0.75, 0.62, 0.38), face);
    metal = face; rough = mix(0.5, 0.3, face); cloth = 1.0;
  }

  // age: soft lines on the face (forehead, crow's feet, nasolabial folds, under-eye)
  if (isHead && uAge > 0.0 && P.z > 0.02) {
    float fx = P.x, fy = y - lEyeY;
    float fore = (1.0 - smoothstep(0.04, 0.055, abs(fx))) * smoothstep(0.03, 0.04, fy) * (1.0 - smoothstep(0.075, 0.09, fy));
    float fl = line(fract(fy * 62.0 + n3(P * 60.0) * 0.6) - 0.5, 0.16) * fore;
    float cfx = abs(fx) - 0.056;
    float crow = (1.0 - smoothstep(0.0, 0.018, length(vec2(cfx, fy * 1.3)))) * line(sin(atan(fy, cfx) * 9.0), 0.4) * step(0.0, cfx);
    float nl = abs(abs(fx) - (0.021 + (-fy - 0.04) * 0.25)) ;
    float naso = (1.0 - smoothstep(0.0, 0.004, nl)) * smoothstep(-0.03, -0.04, fy) * (1.0 - smoothstep(-0.085, -0.095, fy));
    float bag = exp(-pow((fy + 0.018) * 90.0, 2.0)) * (1.0 - smoothstep(0.03, 0.05, abs(abs(fx) - 0.032)));
    float age = (fl * 0.5 + crow * 0.45 + naso * 0.6 + bag * 0.35) * uAge;
    col *= 1.0 - age * 0.22;
    col = mix(col, col * vec3(0.95, 0.88, 0.86), bag * uAge * 0.5);
  }
  if (uMode == 0) gl_FragColor = vec4(col, 1.0);
  else if (uMode == 1) {
    vec3 flatN = vec3(0.5 + (grain - 0.5) * 0.06, 0.5 + (n3(P * 150.0 + 4.0) - 0.5) * 0.06, 1.0);
    gl_FragColor = vec4(mix(nrm, flatN, cloth), 1.0);
  } else {
    float r = cloth > 0.5 ? (rough == skinR ? 0.88 + 0.08 * grain : rough) : skinR;
    gl_FragColor = vec4(1.0, r, metal, 1.0);
  }
}`;

// Fill empty texels from their neighbours so UV seams don't show through.
const DILATE_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv);
  if (c.a > 0.5) { gl_FragColor = c; return; }
  vec4 acc = vec4(0.0);
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec4 s = texture2D(tSrc, vUv + vec2(float(x), float(y)) * uTexel);
    if (s.a > 0.5) acc += vec4(s.rgb, 1.0);
  }
  gl_FragColor = acc.a > 0.0 ? vec4(acc.rgb / acc.a, 1.0) : vec4(0.0);
}`;

export class Characters {
  constructor(game) {
    this.game = game;
    this.gltf = {};
    this.clips = new Map();
    this.ready = false;
    this.poseCache = new Map();
    this.bakeCache = new Map();
  }

  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const files = ['body_m', 'body_f', 'hair_parted', 'hair_buns', 'hair_long', 'hair_beard', 'hair_buzzed', 'mannequin_m', 'mannequin_f', 'mannequin_lod', 'anims_a', 'anims_b'];
    let done = 0;
    // Some hosts won't serve .glb files; for those the build ships the models inside a
    // script as base64 (window.TARE_MODELS, see tools/pack-models.mjs).
    const packed = window.TARE_MODELS || null;
    const fromBase64 = str => { const bin = atob(str), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
    const fetchModel = f => {
      if (!packed?.[f]) return loader.loadAsync(BASE + f + '.glb');
      const buf = fromBase64(packed[f]); delete packed[f];
      // Such hosts may also refuse fetch() of blob: URLs while allowing blob: images, so
      // let three.js decode the embedded textures through <img> (it picks its image
      // loader synchronously when parsing starts, from whether createImageBitmap exists).
      const cib = window.createImageBitmap;
      try { window.createImageBitmap = undefined; } catch (e) { /* read-only: keep the default */ }
      try { return loader.parseAsync(buf, BASE); } finally { try { window.createImageBitmap = cib; } catch (e) { /* ignored */ } }
    };
    await Promise.all(files.map(f => fetchModel(f).then(g => { this.gltf[f] = g; onProgress(++done / (files.length + 4)); })));
    const tl = new THREE.TextureLoader();
    this.skins = {};
    await Promise.all(['m_light', 'm_dark', 'f_light', 'f_dark'].map(k => tl.loadAsync(BASE + 'skin_' + k + '.webp').then(t => {
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; this.skins[k] = t; onProgress(++done / (files.length + 4));
    })));
    for (const k of ['anims_a', 'anims_b']) for (const c of this.gltf[k].animations) this.clips.set(c.name, c);
    this.ready = true;
  }

  clip(name) { return this.clips.get(name); }

  // ------------------------------------------------------------------ building a person
  makeHuman(spec) {
    const key = JSON.stringify(spec);
    const src = this.gltf[spec.body === 'f' ? 'body_f' : 'body_m'];
    const root = SkeletonUtils.clone(src.scene);
    root.name = spec.name || 'human';
    let body = null; const extras = [];
    root.traverse(o => {
      if (o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (/Superhero|SuperHero|Retopology/i.test(o.name) || (o.material && /Superhero/i.test(o.material.name))) body = o; else extras.push(o);
      }
    });
    if (!body) body = extras.shift();
    const bones = {};
    body.skeleton.bones.forEach(b => { bones[b.name] = b; });
    const lm = LM[spec.body === 'f' ? 'f' : 'm'];
    // reshape + dress (cached per spec so repeated people are cheap)
    let baked = this.bakeCache.get(key);
    if (!baked) { baked = this.dress(body, spec, lm); this.bakeCache.set(key, baked); }
    body.geometry = baked.geometry;
    body.material = baked.material;
    // eyebrows / face hair: tint
    for (const e of extras) {
      if (e.material && /Hair/i.test(e.material.name)) e.material = this.hairMaterial(e.material, spec.hairColor || '#4a3a2c', spec.grey ?? 0);
    }
    // hair and beard, rebound to this skeleton
    const parent = body.parent;
    for (const h of [spec.hair, spec.beard ? 'beard' : null]) {
      if (!h) continue;
      const g = this.gltf['hair_' + h];
      if (!g) continue;
      g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => {
        if (!o.isSkinnedMesh) return;
        const m = new THREE.SkinnedMesh(o.geometry, this.hairMaterial(o.material, spec.hairColor || '#4a3a2c', spec.grey ?? 0));
        const sk = new THREE.Skeleton(o.skeleton.bones.map(b => bones[b.name] || bones.Head), o.skeleton.boneInverses);
        m.bind(sk, o.bindMatrix);
        m.castShadow = true; m.frustumCulled = false;
        parent.add(m);
      });
    }
    if (spec.glasses) this.addGlasses(bones.Head, lm, spec);
    const of = OUTFITS[spec.outfit];
    if (of?.coat && spec.coatTails !== false) this.addCoatTails(body, bones, lm, spec);
    else if (of?.dress) {
      // a mid-calf skirt, and the apron over its front
      this.addCoatTails(body, bones, lm, spec, { a0: -Math.PI, a1: Math.PI, top: lm.waist + 0.04, bot: lm.knee - 0.17, color: of.bottom, extra: 0.02, flare: 0.08 });
      if (of.apron) this.addCoatTails(body, bones, lm, spec, { a0: -0.68, a1: 0.68, top: lm.waist + 0.03, bot: lm.knee - 0.07, color: of.apron, extra: 0.034, flare: 0.08 });
    }
    root.scale.setScalar(spec.scale || 1);
    const mixer = new THREE.AnimationMixer(root);
    return { root, body, bones, mixer, spec, lm };
  }

  // Release a person built only for a moment (the photographs): their baked outfit and
  // the cloth and spectacles made for them. Shared hair and body sources are left alone.
  forget(human) {
    const key = JSON.stringify(human.spec);
    const b = this.bakeCache.get(key);
    if (b) {
      this.bakeCache.delete(key);
      b.geometry.dispose();
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) b.material[k]?.dispose?.();
      b.material.dispose();
    }
    human.root.traverse(o => { if (o.userData.ownGeometry) o.geometry.dispose(); });
  }

  hairMaterial(src, color, grey) {
    const m = src.clone();
    m.userData.tint = { value: new THREE.Color(color) };
    m.userData.grey = { value: grey };
    m.onBeforeCompile = sh => {
      sh.uniforms.uTint = m.userData.tint; sh.uniforms.uGrey = m.userData.grey;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint; uniform float uGrey;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum), uGrey) * uTint * 1.7;`);
    };
    m.customProgramCacheKey = () => 'tare-hair';
    m.roughness = 0.7;
    return m;
  }

  // Compute per-vertex masks, reshape the geometry, and bake the outfit textures.
  dress(body, spec, lm) {
    const g = body.geometry.clone();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const n = pos.count;
    const boneNames = body.skeleton.bones.map(b => b.name);
    const groupOf = {};
    for (const [k, list] of Object.entries(BONE_GROUPS)) for (const nm of list) groupOf[nm] = k;
    for (const nm of boneNames) if (!groupOf[nm]) groupOf[nm] = /hand|index|middle|ring|pinky|thumb/.test(nm) ? 'hand' : 'other';
    const mA = new Float32Array(n * 4), mB = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const acc = { torso: 0, upper: 0, lower: 0, hand: 0, thigh: 0, calf: 0, foot: 0, head: 0, other: 0 };
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k); if (w <= 0) continue;
        acc[groupOf[boneNames[si.getComponent(i, k)]] || 'other'] += w;
      }
      mA.set([acc.torso, acc.upper, acc.lower, acc.hand], i * 4);
      mB.set([acc.thigh, acc.calf, acc.foot, acc.head], i * 4);
    }
    const outfit = OUTFITS[spec.outfit] || OUTFITS.brask;
    // --- reshape: weld, smooth muscles under cloth, inflate cloth, belly
    const rest = new Float32Array(pos.array.length);
    for (let i = 0; i < n; i++) { rest[i * 3] = pos.getX(i); rest[i * 3 + 1] = pos.getY(i); rest[i * 3 + 2] = pos.getZ(i); }
    const restN = new Float32Array(nor.array.length);
    for (let i = 0; i < n; i++) { restN[i * 3] = nor.getX(i); restN[i * 3 + 1] = nor.getY(i); restN[i * 3 + 2] = nor.getZ(i); }
    const clothW = new Float32Array(n), thick = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1];
      const ax = Math.abs(x);
      const arm = (mA[i * 4 + 1] + mA[i * 4 + 2] + mA[i * 4 + 3]) > 0.5 || (ax > lm.shoulder + 0.05 && y > lm.armY - 0.16);
      const hand = arm && ax > lm.wrist - 0.005;
      const head = !arm && (mB[i * 4 + 3] > 0.5 || y > lm.neck + 0.02) && y > lm.collar - 0.02;
      const foot = !arm && (mB[i * 4 + 2] > 0.5 || y < lm.ankle);
      const sleeveEnd = outfit.sleeves === 'rolled' ? lm.elbow + 0.06 : lm.wrist - 0.01;
      let w = 0, t = 0;
      if (hand) { w = outfit.gloves ? 0.2 : 0; t = outfit.gloves ? 0.003 : 0; }
      else if (head) { w = 0; t = 0; }
      else if (foot) { w = 0.6; t = 0.011; }
      else if (arm) { if (ax < sleeveEnd) { w = 1; t = outfit.coat ? 0.012 : 0.006; } else { w = 0.25; t = 0; } }
      else if (y < lm.waist) { w = 1; t = outfit.dress && y < lm.knee ? 0.002 : 0.01; }
      else { w = 1; t = (outfit.coat ? 0.014 : 0.007) + (outfit.vest ? 0.006 : 0); }
      // keep a soft ramp around the collar/cuffs so smoothing doesn't tear the edge
      clothW[i] = w; thick[i] = t;
    }
    // weld duplicates (UV seams) by position
    const keyOf = i => `${Math.round(rest[i * 3] * 2e4)},${Math.round(rest[i * 3 + 1] * 2e4)},${Math.round(rest[i * 3 + 2] * 2e4)}`;
    const weld = new Int32Array(n); const map = new Map(); let uniq = 0;
    for (let i = 0; i < n; i++) { const k = keyOf(i); if (!map.has(k)) map.set(k, uniq++); weld[i] = map.get(k); }
    const nb = Array.from({ length: uniq }, () => new Set());
    const idx = g.index;
    for (let f = 0; f < idx.count; f += 3) {
      const a = weld[idx.getX(f)], b = weld[idx.getX(f + 1)], c = weld[idx.getX(f + 2)];
      nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
    }
    const P = new Float32Array(uniq * 3), W = new Float32Array(uniq), T = new Float32Array(uniq), N = new Float32Array(uniq * 3);
    for (let i = 0; i < n; i++) {
      const u = weld[i];
      P[u * 3] = rest[i * 3]; P[u * 3 + 1] = rest[i * 3 + 1]; P[u * 3 + 2] = rest[i * 3 + 2];
      W[u] = Math.max(W[u], clothW[i]); T[u] = Math.max(T[u], thick[i]);
      N[u * 3] += restN[i * 3]; N[u * 3 + 1] += restN[i * 3 + 1]; N[u * 3 + 2] += restN[i * 3 + 2];
    }
    // Laplacian smoothing restricted to clothed areas (muscle relief goes, silhouette stays)
    const iters = spec.smooth ?? 6;
    const tmp = new Float32Array(P.length);
    for (let it = 0; it < iters; it++) {
      for (let u = 0; u < uniq; u++) {
        const s = nb[u]; if (!s.size || W[u] <= 0) { tmp[u * 3] = P[u * 3]; tmp[u * 3 + 1] = P[u * 3 + 1]; tmp[u * 3 + 2] = P[u * 3 + 2]; continue; }
        let x = 0, y = 0, z = 0;
        for (const v of s) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; }
        const k = 0.5 * W[u];
        tmp[u * 3] = P[u * 3] + (x / s.size - P[u * 3]) * k;
        tmp[u * 3 + 1] = P[u * 3 + 1] + (y / s.size - P[u * 3 + 1]) * k * 0.6;
        tmp[u * 3 + 2] = P[u * 3 + 2] + (z / s.size - P[u * 3 + 2]) * k;
      }
      P.set(tmp);
    }
    // inflate along the (welded) normal, add a belly / soften the chest per spec
    const belly = spec.belly || 0, bust = spec.bust ?? 0;
    for (let u = 0; u < uniq; u++) {
      let nx = N[u * 3], ny = N[u * 3 + 1], nz = N[u * 3 + 2];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const t = T[u];
      P[u * 3] += nx * t; P[u * 3 + 1] += ny * t * 0.5; P[u * 3 + 2] += nz * t;
      const x = P[u * 3], y = P[u * 3 + 1], z = P[u * 3 + 2];
      if (belly && z > -0.02 && Math.abs(x) < 0.2) {
        const b = Math.exp(-Math.pow((y - (lm.waist + 0.08)) / 0.13, 2)) * Math.exp(-Math.pow(x / 0.14, 2));
        P[u * 3 + 2] += belly * b * Math.max(0, nz);
        P[u * 3] += belly * b * 0.3 * Math.sign(x) * Math.abs(nx);
      }
      if (bust && z > 0.02 && Math.abs(y - lm.chest) < 0.12) {
        const b = Math.exp(-Math.pow((y - lm.chest) / 0.07, 2)) * Math.exp(-Math.pow((Math.abs(x) - 0.08) / 0.06, 2));
        P[u * 3 + 2] += bust * b;
      }
    }
    for (let i = 0; i < n; i++) { const u = weld[i]; pos.setXYZ(i, P[u * 3], P[u * 3 + 1], P[u * 3 + 2]); }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    // smooth the normals across UV seams (computeVertexNormals splits them)
    const acc = new Float32Array(uniq * 3);
    for (let i = 0; i < n; i++) { const u = weld[i]; acc[u * 3] += g.attributes.normal.getX(i); acc[u * 3 + 1] += g.attributes.normal.getY(i); acc[u * 3 + 2] += g.attributes.normal.getZ(i); }
    for (let i = 0; i < n; i++) { const u = weld[i]; const x = acc[u * 3], y = acc[u * 3 + 1], z = acc[u * 3 + 2]; const l = Math.hypot(x, y, z) || 1; g.attributes.normal.setXYZ(i, x / l, y / l, z / l); }
    // --- bake textures in UV space
    const skinKey = (spec.body === 'f' ? 'f_' : 'm_') + (spec.skin || 'light');
    const srcMat = body.material;
    const tex = this.bake(g, rest, restN, mA, mB, srcMat, this.skins[skinKey] || srcMat.map, outfit, lm, spec.age || 0);
    const material = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normal, roughnessMap: tex.orm, metalnessMap: tex.orm, roughness: 1, metalness: 1, envMapIntensity: 0.7 });
    material.name = 'dressed:' + spec.outfit;
    return { geometry: g, material };
  }

  bake(geom, rest, restN, mA, mB, srcMat, skinTex, outfit, lm, age = 0) {
    const renderer = this.game.engine.renderer;
    const size = 1024;
    const bg = new THREE.BufferGeometry();
    bg.setIndex(geom.index);
    bg.setAttribute('position', geom.attributes.position);
    bg.setAttribute('uv', geom.attributes.uv);
    bg.setAttribute('rpos', new THREE.BufferAttribute(rest, 3));
    bg.setAttribute('rnorm', new THREE.BufferAttribute(restN, 3));
    bg.setAttribute('mA', new THREE.BufferAttribute(mA, 4));
    bg.setAttribute('mB', new THREE.BufferAttribute(mB, 4));
    const u = {
      tSkin: { value: skinTex }, tSkinN: { value: srcMat.normalMap }, tSkinR: { value: srcMat.roughnessMap || srcMat.map }, uMode: { value: 0 },
      cTop: { value: hex(outfit.top) }, cVest: { value: hex(outfit.vest || '#000') }, cBottom: { value: hex(outfit.bottom) }, cLegs: { value: hex(outfit.legs || outfit.bottom) },
      cShoes: { value: hex(outfit.shoes) }, cBelt: { value: hex(outfit.belt || '#000') }, cGlove: { value: hex(outfit.gloves || '#000') }, cApron: { value: hex(outfit.apron || '#fff') }, cUnder: { value: hex(outfit.under || '#000') },
      uVest: { value: outfit.vest ? 1 : 0 }, uBelt: { value: outfit.belt ? 1 : 0 }, uGlove: { value: outfit.gloves ? 1 : 0 }, uButtons: { value: outfit.buttons ? 1 : 0 },
      uCoat: { value: outfit.coat ? 1 : 0 }, uDress: { value: outfit.dress ? 1 : 0 }, uApron: { value: outfit.apron ? 1 : 0 }, uWatch: { value: outfit.watch ? 1 : 0 },
      uRolled: { value: outfit.sleeves === 'rolled' ? 1 : 0 }, uLegs: { value: outfit.legs && !outfit.dress ? 1 : 0 }, uPocket: { value: outfit.pocket ? 1 : 0 }, uCollar: { value: outfit.collar || 0 }, uTopKind: { value: outfit.topKind ?? 1 },
      lWaist: { value: lm.waist }, lCollar: { value: lm.collar }, lNeck: { value: lm.neck }, lWrist: { value: lm.wrist }, lElbow: { value: lm.elbow }, lShoulder: { value: lm.shoulder },
      lKnee: { value: lm.knee }, lAnkle: { value: lm.ankle }, lChest: { value: lm.chest }, lArmY: { value: lm.armY }, lEyeY: { value: lm.eyeY }, uAge: { value: age },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, uniforms: u, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(bg, mat); mesh.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(mesh);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadScene = new THREE.Scene();
    const dil = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2(1 / size, 1 / size) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: DILATE_FRAG, depthTest: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dil); quad.frustumCulled = false; quadScene.add(quad);
    const prev = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color()); const prevA = renderer.getClearAlpha();
    const out = {};
    for (const [slot, mode, srgb] of [['map', 0, true], ['normal', 1, false], ['orm', 2, false]]) {
      const opts = { type: THREE.UnsignedByteType, colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace, depthBuffer: false };
      const a = new THREE.WebGLRenderTarget(size, size, opts);
      const b = new THREE.WebGLRenderTarget(size, size, { ...opts, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      u.uMode.value = mode;
      renderer.setRenderTarget(a); renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(scene, cam);
      dil.uniforms.tSrc.value = a.texture;
      renderer.setRenderTarget(b); renderer.clear(); renderer.render(quadScene, cam);
      a.dispose();
      b.texture.flipY = false;
      out[slot] = b.texture;
    }
    renderer.setRenderTarget(prev); renderer.setClearColor(prevClear, prevA);
    mat.dispose(); dil.dispose(); quad.geometry.dispose();
    return out;
  }

  addGlasses(head, lm, spec) {
    const mats = this.game.engine.materials;
    const g = new THREE.Group();
    const rimMat = mats.plain(spec.glassesColor || '#2a2420', { rough: 0.35, metal: 0.4 });
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0019, 6, 28), rimMat);
      rim.position.set(s * 0.032, 0, 0); g.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 20), mats.glass({ opacity: 0.12 }));
      lens.position.set(s * 0.032, 0, 0.001); g.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.0025, 0.1), rimMat);
      arm.position.set(s * 0.066, 0.004, -0.05); arm.rotation.y = s * -0.06; g.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0016, 4, 10, Math.PI), rimMat);
    bridge.position.set(0, 0.004, 0.001); g.add(bridge);
    // position at the eyes in rest pose, expressed in the head bone's frame
    head.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    const world = new THREE.Matrix4().compose(V(0, lm.eyeY + 0.002, lm.eyeZ + 0.03), new THREE.Quaternion(), V(1, 1, 1));
    // the cloned skeleton's world matrix is the rest pose at this point
    const local = inv.multiply(world);
    g.applyMatrix4(local);
    g.traverse(o => { o.castShadow = false; if (o.isMesh) o.userData.ownGeometry = true; });
    head.add(g);
  }

  // Long coat tails from waist to knee, skinned to pelvis + thighs so they swing.
  // Cloth hanging from the waist, skinned to pelvis and thighs: open-fronted coat tails by
  // default; with options, a closed skirt for a dress or an apron panel over it.
  addCoatTails(body, bones, lm, spec, { a0 = null, a1 = null, top = lm.waist + 0.07, bot = lm.knee - 0.02, color = null, extra = 0.022, flare = 0.03 } = {}) {
    const outfit = OUTFITS[spec.outfit];
    const pos = body.geometry.attributes.position;
    const rings = 7, seg = 36;
    // body cross-section radius per angle at a height (from the reshaped mesh)
    const radiusAt = (y, ang) => {
      let best = 0.12;
      for (let i = 0; i < pos.count; i += 2) {
        const py = pos.getY(i); if (Math.abs(py - y) > 0.03) continue;
        const px = pos.getX(i), pz = pos.getZ(i);
        if (Math.abs(px) > 0.3) continue;
        const a = Math.atan2(px, pz + 0.03);
        let d = Math.abs(a - ang); d = Math.min(d, Math.PI * 2 - d);
        if (d < 0.2) best = Math.max(best, Math.hypot(px, pz + 0.03));
      }
      return best;
    };
    const verts = [], uvs = [], idx = [], sI = [], sW = [];
    const bi = name => body.skeleton.bones.indexOf(bones[name]);
    const pelvis = bi('pelvis'), tl = bi('thigh_l'), tr = bi('thigh_r');
    const gap = 0.16; // coats are open at the front
    const from = a0 ?? gap / 2, to = a1 ?? Math.PI * 2 - gap / 2;
    const prof = [];
    for (let s = 0; s <= seg; s++) prof.push(from + (to - from) * s / seg);
    const ringR = [];
    for (let r = 0; r <= rings; r++) { const y = top + (bot - top) * r / rings; ringR.push(prof.map(a => radiusAt(Math.max(y, lm.knee + 0.1), a))); }
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const y = top + (bot - top) * t;
      for (let s = 0; s <= seg; s++) {
        const a = prof[s];
        const rad = Math.max(ringR[r][s], ringR[Math.min(r + 1, rings)][s]) + extra + t * flare;
        const x = Math.sin(a) * rad, z = Math.cos(a) * rad - 0.03;
        verts.push(x, y, z);
        uvs.push(s / seg, t);
        const side = Math.sin(a);
        const k = t * 0.85;
        const wl = k * clamp((side + 0.25) / 0.9, 0, 1);
        const wr = k * clamp((-side + 0.25) / 0.9, 0, 1);
        const wp = Math.max(0, 1 - wl - wr);
        sI.push(pelvis, tl, tr, 0); sW.push(wp, wl, wr, 0);
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sI, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // UVs in metres so the shared fabric texture tiles at its natural scale
    const uvA = geo.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 1.7 * (to - from) / (Math.PI * 2), uvA.getY(i) * (top - bot));
    const m = this.game.engine.materials.get({ type: 'fabric', tint: color || outfit.top, seed: 4, side: THREE.DoubleSide, grime: 0, macro: 0.05 });
    const tails = new THREE.SkinnedMesh(geo, m);
    tails.bind(body.skeleton, body.bindMatrix);
    tails.castShadow = true; tails.frustumCulled = false; tails.userData.ownGeometry = true;
    body.parent.add(tails);
  }

  // ------------------------------------------------------------------ the first-person arm
  // The right forearm and gloved hand of a dressed body, posed by a frame of the
  // torch-holding animation, baked to a static mesh and fitted around the tare's grip.
  viewArm() {
    const h = this.makeHuman({ body: 'm', skin: 'light', outfit: 'auditor', hair: null, coatTails: false, smooth: 3, name: 'viewarm' });
    const clip = this.clip('Idle_Torch_Loop');
    if (clip) { const a = h.mixer.clipAction(clip); a.play(); h.mixer.setTime(0.4); }
    h.root.updateMatrixWorld(true);
    const body = h.body;
    body.skeleton.update();
    const names = body.skeleton.bones.map(b => b.name);
    const keep = new Set(names.filter(n => /_r$/.test(n) && /(lowerarm|hand|index|middle|ring|pinky|thumb)/.test(n)).map(n => names.indexOf(n)));
    const upper = names.indexOf('upperarm_r');
    const g = body.geometry;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const dominant = i => { let best = -1, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } } return best; };
    const vKeep = new Uint8Array(g.attributes.position.count);
    for (let i = 0; i < vKeep.length; i++) { const d = dominant(i); vKeep[i] = keep.has(d) || (d === upper && g.attributes.position.getX(i) < -0.38) ? 1 : 0; }
    const idx = g.index;
    const pos = [], uv = [], tri = [];
    const remap = new Map();
    const v = new THREE.Vector3();
    const vid = i => {
      if (remap.has(i)) return remap.get(i);
      body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld);
      pos.push(v.x, v.y, v.z); uv.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i));
      remap.set(i, pos.length / 3 - 1);
      return pos.length / 3 - 1;
    };
    for (let f = 0; f < idx.count; f += 3) {
      const a = idx.getX(f), b = idx.getX(f + 1), c = idx.getX(f + 2);
      if (!(vKeep[a] && vKeep[b] && vKeep[c])) continue;
      tri.push(vid(a), vid(b), vid(c));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(tri);
    geo.computeVertexNormals();
    // smooth across UV seams too: average normals of coincident vertices
    { const nA = geo.attributes.normal, pA = geo.attributes.position, key = i => `${Math.round(pA.getX(i) * 1e4)},${Math.round(pA.getY(i) * 1e4)},${Math.round(pA.getZ(i) * 1e4)}`, acc = new Map();
      for (let i = 0; i < pA.count; i++) { const k = key(i); const e = acc.get(k) || [0, 0, 0]; e[0] += nA.getX(i); e[1] += nA.getY(i); e[2] += nA.getZ(i); acc.set(k, e); }
      for (let i = 0; i < pA.count; i++) { const e = acc.get(key(i)); const l = Math.hypot(...e) || 1; nA.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); } }
    // key points of the posed hand (world space of the posed body)
    const wp = name => h.bones[name].getWorldPosition(new THREE.Vector3());
    const I1 = wp('index_01_r'), P1 = wp('pinky_01_r'), H = wp('hand_r'), E = wp('lowerarm_r'), T2 = wp('thumb_02_r');
    const axis = I1.clone().sub(P1).normalize();
    const knuckles = I1.clone().add(P1).multiplyScalar(0.5);
    const palmDir = T2.clone().sub(knuckles).normalize();
    const C = knuckles.clone().lerp(T2, 0.38).addScaledVector(palmDir.clone().cross(axis).normalize(), 0.0);
    const fore = E.clone().sub(H).normalize();
    // build a frame: grip axis -> instrument grip axis; forearm -> back toward the camera
    const gAxis = new THREE.Vector3(0, Math.cos(0.28), Math.sin(0.28)).normalize();
    const want = new THREE.Vector3(0.35, -0.55, 1).normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(axis, gAxis);
    const f1 = fore.clone().applyQuaternion(q1);
    const proj = (vv) => vv.clone().addScaledVector(gAxis, -vv.dot(gAxis)).normalize();
    const a1 = proj(f1), a2 = proj(want);
    let ang = Math.acos(Math.max(-1, Math.min(1, a1.dot(a2))));
    if (a1.clone().cross(a2).dot(gAxis) < 0) ang = -ang;
    const q2 = new THREE.Quaternion().setFromAxisAngle(gAxis, ang);
    const q = q2.multiply(q1);
    const mesh = new THREE.Mesh(geo, body.material);
    mesh.frustumCulled = false; mesh.castShadow = false;
    const grip = new THREE.Vector3(0, -0.02, 0);
    mesh.quaternion.copy(q);
    mesh.position.copy(grip).sub(C.clone().applyQuaternion(q));
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }

  // ------------------------------------------------------------------ NPCs
  spawnNPC(L, opts) {
    const npc = new NPC(L, this.makeHuman(opts.spec), opts);
    L.entities.push(npc);
    return npc;
  }

  // ------------------------------------------------------------------ mannequins (static, instanced)
  // Bake a posed mannequin into a static geometry (cached per pose).
  posedMannequin(female, clipName, time, lod = false) {
    const key = `${female}|${clipName}|${time}|${lod}`;
    if (this.poseCache.has(key)) return this.poseCache.get(key);
    const src = this.gltf[lod ? 'mannequin_lod' : female ? 'mannequin_f' : 'mannequin_m'];
    const root = SkeletonUtils.clone(src.scene);
    const mixer = new THREE.AnimationMixer(root);
    const clip = this.clip(clipName);
    if (clip) { const a = mixer.clipAction(clip); a.play(); mixer.setTime(Math.min(time, clip.duration - 0.01)); }
    root.updateMatrixWorld(true);
    const parts = [];
    root.traverse(o => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      const g = o.geometry;
      const n = g.attributes.position.count;
      const out = new Float32Array(n * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(out, 3));
      if (g.index) bg.setIndex(g.index.clone());
      bg.computeVertexNormals();
      parts.push({ geometry: bg, joints: /Joint/i.test(o.material.name) });
    });
    // mannequin GLBs use one mesh with two primitives: three splits them into two meshes
    this.poseCache.set(key, parts);
    return parts;
  }

  mannequinMaterials() {
    if (this._mqm) return this._mqm;
    const mats = this.game.engine.materials;
    this._mqm = {
      body: new THREE.MeshStandardMaterial({ color: '#d6cdbb', roughness: 0.62, metalness: 0 }),
      joints: mats.get('veneer_walnut'),
      bodyDark: new THREE.MeshStandardMaterial({ color: '#b8ad98', roughness: 0.7 }),
    };
    return this._mqm;
  }

  static POSES = {
    stand: ['Idle_Loop', 0.2], stand2: ['Idle_Loop', 1.4], fold: ['Idle_FoldArms_Loop', 0.5], sit: ['Sitting_Idle_Loop', 0.5],
    talk: ['Idle_Talking_Loop', 0.8], lean: ['Idle_Rail_Loop', 0.6], kneel: ['Fixing_Kneeling', 1.0], lie: ['Death01', 3.0],
    phone: ['Idle_TalkingPhone_Loop', 0.5], lantern: ['Idle_Lantern_Loop', 0.4], wave: ['Idle_Rail_Call', 0.9], crouch: ['Crouch_Idle_Loop', 0.4],
  };

  spawnMannequin(L, { pos, yaw = 0, pose = 'stand', female = false, scale = 1, dark = false, lod = false, collide = true, shadow = true }) {
    if (!L._mq) L._mq = new Map();
    const [clip, t] = Characters.POSES[pose] || Characters.POSES.stand;
    const key = `${female}|${clip}|${t}|${dark}|${lod}|${shadow}`;
    if (!L._mq.has(key)) L._mq.set(key, { female, clip, t, dark, lod, shadow, items: [] });
    L._mq.get(key).items.push({ pos, yaw, scale });
    if (!collide) return;
    // collider: a capsule-ish box so people don't walk through them
    if (pose !== 'lie') L.phys.fixedBox([pos[0], pos[1] + 0.85 * scale, pos[2]], [0.2 * scale, 0.85 * scale, 0.15 * scale], { info: { kind: 'static', surface: 'wood' } });
    else L.phys.fixedBox([pos[0], pos[1] + 0.12, pos[2]], [0.5, 0.12, 0.5], { info: { kind: 'static', surface: 'wood' } });
  }

  finalize(L) {
    if (!L._mq) return;
    const mm = this.mannequinMaterials();
    for (const g of L._mq.values()) {
      const parts = this.posedMannequin(g.female, g.clip, g.t, g.lod);
      for (const p of parts) {
        const mat = p.joints ? mm.joints : (g.dark ? mm.bodyDark : mm.body);
        const im = new THREE.InstancedMesh(p.geometry, mat, g.items.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion();
        const r = rng(g.items.length * 7 + 3);
        g.items.forEach((it, i) => {
          q.setFromAxisAngle(V(0, 1, 0), it.yaw);
          m.compose(V(...it.pos), q, V(it.scale, it.scale, it.scale));
          im.setMatrixAt(i, m);
          if (!p.joints) im.setColorAt(i, new THREE.Color().setHSL(0.11, 0.12 + r() * 0.08, 0.75 + r() * 0.12));
        });
        im.castShadow = g.shadow !== false; im.receiveShadow = true;
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        L.root.add(im);
      }
    }
  }

  // ------------------------------------------------------------------ weighted Reference Persons
  spawnRefPerson(L, opts) {
    const rp = new RefPerson(L, this, opts);
    L.entities.push(rp);
    return rp;
  }
}

// ------------------------------------------------------------------ NPC controller
export class NPC {
  constructor(L, human, { pos, yaw = 0, anim = 'Idle_Loop', look = true, name = 'npc', idles = null }) {
    this.L = L; this.game = L.game; this.h = human;
    this.root = human.root;
    this.root.position.set(...pos);
    this.root.rotation.y = yaw;
    this.yaw = yaw;
    L.root.add(this.root);
    this.mixer = human.mixer;
    this.actions = new Map();
    this.current = null;
    this.look = look; this.lookW = 0;
    this.name = name;
    this.idles = idles;
    this.path = null;
    this.speed = 1.25;
    this.play(anim);
    this.headFwd = null;
    this.capsule = L.phys.kinematicBody([pos[0], pos[1] + 0.9, pos[2]]);
    L.phys.attach(R.ColliderDesc.capsule(0.6, 0.28), this.capsule, { kind: 'static', surface: 'stone' }, GROUPS.static);
    if (name) L.named[name] = this;
    // remember the head's forward axis in its own frame at rest
    this.root.updateMatrixWorld(true);
    const hb = human.bones.Head;
    const hq = hb.getWorldQuaternion(new THREE.Quaternion());
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
    this.headFwd = V(0, 0, 1).applyQuaternion(rq).applyQuaternion(hq.invert());
    this.posture = human.spec.posture || 0;
  }
  action(name) {
    if (this.actions.has(name)) return this.actions.get(name);
    const clip = this.game.characters.clip(name);
    if (!clip) return null;
    const a = this.mixer.clipAction(clip);
    this.actions.set(name, a);
    return a;
  }
  play(name, { fade = 0.45, loop = true, timeScale = 1, clamp: cl = false } = {}) {
    const a = this.action(name);
    if (!a || a === this.current) return a;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = cl || !loop;
    a.timeScale = timeScale;
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.time = loop ? Math.random() * a.getClip().duration : 0;
    if (this.current) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    this.currentName = name;
    return a;
  }
  // play a one-shot then return to an idle
  async once(name, then = 'Idle_Loop') {
    const a = this.play(name, { loop: false });
    if (!a) return;
    await this.game.story.wait(Math.max(0.2, a.getClip().duration - 0.35));
    this.play(then);
  }
  walkTo(points, { speed = 1.25, then = 'Idle_Loop' } = {}) {
    this.path = points.map(p => V(...p)); this.speed = speed; this.thenAnim = then;
    this.play('Walk_Loop', { timeScale: speed / 1.25 });
    return new Promise(res => { this.onArrive = res; });
  }
  face(yaw) { this.targetYaw = yaw; }
  faceTarget(p) { this.targetYaw = Math.atan2(p[0] - this.root.position.x, p[2] - this.root.position.z); }
  update(dt) {
    if (this.path && this.path.length) {
      const tgt = this.path[0];
      const d = tgt.clone().sub(this.root.position); d.y = 0;
      const dist = d.length();
      if (dist < 0.08) { this.path.shift(); if (!this.path.length) { this.path = null; this.play(this.thenAnim || 'Idle_Loop'); this.onArrive?.(); } }
      else {
        const want = Math.atan2(d.x, d.z);
        let dy = want - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += clamp(dy, -4 * dt, 4 * dt);
        this.root.position.addScaledVector(d.normalize(), Math.min(dist, this.speed * dt));
        this.root.position.y = tgt.y + (this.root.position.y - tgt.y) * 0.9;
      }
    } else if (this.targetYaw !== undefined) {
      let dy = this.targetYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += clamp(dy, -2.5 * dt, 2.5 * dt);
    }
    this.root.rotation.y = this.yaw;
    this.mixer.update(dt);
    // posture: older people stoop a little
    if (this.posture) { const s = this.h.bones.spine_03; if (s) s.rotateX(this.posture * 0.5); const nk = this.h.bones.neck_01; if (nk) nk.rotateX(this.posture * 0.4); }
    this.root.updateMatrixWorld(true);
    this.lookAt(dt);
    const p = this.root.position;
    this.capsule.setNextKinematicTranslation({ x: p.x, y: p.y + 0.9, z: p.z });
  }
  lookAt(dt) {
    const head = this.h.bones.Head, neck = this.h.bones.neck_01;
    if (!head || !this.look) return;
    const cam = this.game.engine.camera.position;
    const hp = head.getWorldPosition(V());
    const to = cam.clone().sub(hp);
    const dist = to.length();
    const fwdBody = V(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const flat = to.clone(); flat.y = 0; flat.normalize();
    const facing = flat.dot(fwdBody);
    const want = dist < 9 && facing > -0.1 ? 1 : 0;
    this.lookW = damp(this.lookW, want * (this.lookOverride ?? 1), 3, dt);
    if (this.lookW < 0.01) return;
    const hq = head.getWorldQuaternion(new THREE.Quaternion());
    const cur = this.headFwd.clone().applyQuaternion(hq).normalize();
    const target = to.normalize();
    // limit how far the head turns
    const ang = cur.angleTo(target);
    const maxA = 1.1;
    const tdir = ang > maxA ? cur.clone().lerp(target, maxA / ang).normalize() : target;
    const delta = new THREE.Quaternion().setFromUnitVectors(cur, tdir);
    const part = (bone, k) => {
      const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
      const d = new THREE.Quaternion().slerp(delta, k * this.lookW);
      const newWorld = d.multiply(boneQ);
      bone.quaternion.copy(parentQ.invert().multiply(newWorld));
      bone.updateMatrixWorld(true);
    };
    if (neck) part(neck, 0.35);
    part(head, 0.55);
  }
  reset() {}
  dispose() {}
}

// ------------------------------------------------------------------ Reference Person
class RefPerson extends Weighted {
  constructor(L, chars, { pos, yaw = 0, weight = 4, female = false, name = 'reference person', tag = null, min = -6, max = 9 }) {
    super(L, { weight, name, carriable: false, min, max });
    this.kind = 'refperson';
    this.size = 1.8;
    this.spawn = { pos: [...pos], rotY: yaw, weight };
    const mm = chars.mannequinMaterials();
    const parts = chars.posedMannequin(female, 'Idle_Loop', 0.2);
    const g = new THREE.Group();
    const inner = new THREE.Group(); inner.position.y = -0.9; g.add(inner);
    for (const p of parts) { const m = new THREE.Mesh(p.geometry, p.joints ? mm.joints : mm.body); m.castShadow = m.receiveShadow = true; inner.add(m); }
    // a brass weight tag hung on the chest with a numeral drum
    const tagG = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.012), L.game.engine.materials.get('brass'));
    tagG.add(plate);
    const d = new Drum(0.1); d.mesh.position.z = 0.007; tagG.add(d.mesh); d.set(weight); this.drums.push(d);
    const d2 = new Drum(0.1); d2.mesh.position.z = -0.007; d2.mesh.rotation.y = Math.PI; tagG.add(d2.mesh); d2.set(weight); this.drums.push(d2);
    tagG.position.set(0, 1.22 - 0.9, female ? 0.17 : 0.16);
    g.add(tagG);
    this.object = g;
    L.root.add(g);
    this.body = L.phys.dynamicBody([pos[0], pos[1] + 0.92, pos[2]], { linDamp: 0.2, angDamp: 2 });
    this.body.setRotation(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), true);
    this.body.setEnabledRotations(false, true, false, true);
    this.collider = L.phys.attach(R.ColliderDesc.capsule(0.6, 0.26).setMass(UNIT_MASS).setFriction(0.8).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(1400), this.body, { kind: 'crate', owner: this, impactSound: true, surface: 'wood', material: 'wood' });
    this.applyGravity();
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    const t = this.body.translation(), r = this.body.rotation();
    this.object.position.set(t.x, t.y, t.z);
    this.object.quaternion.set(r.x, r.y, r.z, r.w);
    if (this.shake > 0) this.object.position.x += (Math.random() - 0.5) * this.shake * 0.02;
    this.updateDrums(dt);
  }
  fixedUpdate() {}
  respawn(resetWeight = true) {
    const s = this.spawn;
    this.body.setTranslation({ x: s.pos[0], y: s.pos[1] + 0.95, z: s.pos[2] }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s.rotY), true);
    if (resetWeight) this.setWeight(s.weight, { silent: true });
  }
  reset() {}
  dispose() { for (const d of this.drums) d.dispose(); }
}
