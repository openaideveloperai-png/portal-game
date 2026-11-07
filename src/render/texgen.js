// GPU procedural texture generator.
//
// Every surface material in the game is painted at load time by a small GLSL
// "material function" that returns albedo / height / roughness / metalness / AO for a
// point in a tileable [0,1]^2 domain. Three passes render albedo (sRGB), a normal map
// derived from the height field, and a packed ORM map. Results are cached per variant.
//
// The aim is not perfect realism but *believable wear*: grout that is dirtier than the
// tiles, terrazzo with brass divider strips, board-formed concrete with tie holes and
// grain, paint chipped back to primer — the kind of history a real building collects.
import * as THREE from 'three';

const LIB = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform int uMode;
uniform float uSeed;
uniform vec2 uTexel;
uniform vec3 uTint;
uniform vec3 uTint2;
uniform float uNormalStrength;
uniform float uParam;
#define PI 3.14159265359

vec3 srgb(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

// Periodic value + gradient noise: tiles seamlessly with period 'per'.
float vnoise(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(mod(i, per) + uSeed), b = hash12(mod(i + vec2(1., 0.), per) + uSeed);
  float c = hash12(mod(i + vec2(0., 1.), per) + uSeed), d = hash12(mod(i + vec2(1., 1.), per) + uSeed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec2 grad(vec2 c) { float a = hash12(c + uSeed * 1.31) * 6.2831853; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(mod(i, per)), f);
  float b = dot(grad(mod(i + vec2(1., 0.), per)), f - vec2(1., 0.));
  float c = dot(grad(mod(i + vec2(0., 1.), per)), f - vec2(0., 1.));
  float d = dot(grad(mod(i + vec2(1., 1.), per)), f - vec2(1., 1.));
  return 0.5 + 0.7 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, vec2 per, int oct) {
  float s = 0., a = 0.5, n = 0.;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * gnoise(p, per); n += a; p *= 2.0; per *= 2.0; a *= 0.5; }
  return s / n;
}
float ridged(vec2 p, vec2 per, int oct) {
  float s = 0., a = 0.5, n = 0.;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * (1.0 - abs(gnoise(p, per) * 2.0 - 1.0)); n += a; p *= 2.0; per *= 2.0; a *= 0.5; }
  return s / n;
}
// x: F1, y: F2, z: cell hash, w: distance to cell border (iq two-pass)
vec4 voronoi(vec2 p, vec2 per) {
  vec2 n = floor(p), f = fract(p);
  vec2 mg, mr; float md = 8.0, md2 = 8.0; vec2 cell = vec2(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(mod(n + g, per) + uSeed * 1.7);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < md) { md2 = md; md = d; mr = r; mg = g; cell = mod(n + g, per); } else if (d < md2) md2 = d;
  }
  float bd = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = hash22(mod(n + g, per) + uSeed * 1.7);
    vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) bd = min(bd, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec4(sqrt(md), sqrt(md2), hash12(cell + uSeed * 3.1), bd);
}
// Thin random scratches: returns 0..1 intensity
float scratches(vec2 uv, float density, float len) {
  float s = 0.;
  for (int k = 0; k < 3; k++) {
    float sc = density * (1.0 + float(k) * 0.7);
    vec2 g = uv * sc; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float r = hash12(mod(id, vec2(sc)) + float(k) * 17.0 + uSeed);
    if (r > 0.55) continue;
    float a = hash12(mod(id, vec2(sc)) * 1.7 + float(k)) * PI;
    vec2 d = vec2(cos(a), sin(a));
    vec2 o = (hash22(mod(id, vec2(sc)) + 3.0) - 0.5) * 0.4;
    vec2 q = f - o;
    float along = dot(q, d), across = dot(q, vec2(-d.y, d.x));
    float w = 0.012 + 0.01 * r;
    s = max(s, (1.0 - smoothstep(w * 0.4, w, abs(across))) * (1.0 - smoothstep(len * 0.3, len * 0.5, abs(along))));
  }
  return s;
}
struct M { vec3 alb; float h; float rough; float metal; float ao; float alpha; };
M newM() { M m; m.alb = vec3(0.5); m.h = 0.5; m.rough = 0.8; m.metal = 0.; m.ao = 1.; m.alpha = 1.; return m; }
`;

// ------------------------------------------------------------------ material bodies
const MATS = {};

// Terrazzo with three chip sizes and brass divider strips on a 1 m grid.
MATS.terrazzo = { world: 1.0, height: 0.0015, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float n = fbm(uv * 6., vec2(6.), 4);
  vec3 col = uTint * (0.9 + 0.16 * n);
  float h = 0.5 + (n - 0.5) * 0.05;
  for (int s = 0; s < 3; s++) {
    float sc = s == 0 ? 26. : (s == 1 ? 58. : 120.);
    vec4 v = voronoi(uv * sc + float(s) * 0.31, vec2(sc));
    float id = v.z;
    float r = mix(0.16, 0.42, hash11(id * 13.1 + float(s)));
    float d = v.x + (gnoise(uv * sc * 2.5, vec2(sc * 2.5)) - 0.5) * 0.22;
    float chip = 1.0 - smoothstep(r - 0.03, r + 0.015, d);
    float pick = hash11(id * 7.7 + float(s) * 3.0);
    vec3 cc = pick < .34 ? vec3(.93, .91, .87) : pick < .52 ? vec3(.16, .15, .14) : pick < .66 ? vec3(.74, .55, .26) : pick < .76 ? vec3(.56, .25, .17) : pick < .88 ? vec3(.44, .48, .41) : vec3(.62, .60, .56);
    cc = srgb(cc) * (0.8 + 0.4 * hash11(id * 3.3));
    float keep = step(0.3, hash11(id * 5.1 + float(s)));
    col = mix(col, cc, chip * keep);
    h -= chip * keep * 0.01;
  }
  vec2 e = min(uv, 1. - uv); float ed = min(e.x, e.y);
  float strip = 1.0 - smoothstep(0.0018, 0.0034, ed);
  float scr = scratches(uv, 9., 0.6);
  col = mix(col, srgb(vec3(.70, .55, .32)) * (0.8 + 0.3 * n), strip);
  m.alb = col * (1. - scr * 0.05);
  m.metal = strip * 0.9;
  m.rough = mix(0.28, 0.5, fbm(uv * 14., vec2(14.), 3)) + scr * 0.12;
  m.rough = mix(m.rough, 0.38, strip);
  m.h = h + strip * 0.04 - scr * 0.02;
  return m;
}`};

// Glazed wall tiles, 8x8 per texture. uTint = glaze colour, uTint2 = grout colour.
MATS.tiles = { world: 1.2, height: 0.0035, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float N = 8.;
  vec2 g = uv * N; vec2 id = floor(g); vec2 f = fract(g);
  float rnd = hash12(mod(id, vec2(N)) + uSeed);
  vec2 e = min(f, 1. - f); float ed = min(e.x, e.y);
  float grout = 1. - smoothstep(0.010, 0.022, ed);
  float bevel = smoothstep(0.010, 0.07, ed);
  float wav = gnoise(uv * N * 1.7 + rnd * 5., vec2(N * 1.7));
  vec3 tile = uTint * (0.92 + 0.12 * rnd) * (0.97 + 0.06 * wav);
  // a few tiles were replaced over the years in a slightly different batch
  tile *= mix(vec3(1.), vec3(1.04, 1.02, 0.95), step(0.94, hash12(mod(id, vec2(N)) * 2.3)));
  vec4 v = voronoi(uv * N * 2.5, vec2(N * 2.5));
  float craze = (1. - smoothstep(0.0, 0.015, v.w)) * step(0.82, hash12(mod(id, vec2(N)) * 1.3));
  float dirt = fbm(uv * 30., vec2(30.), 3);
  vec3 groutCol = uTint2 * (0.65 + 0.5 * dirt);
  vec3 col = mix(tile, groutCol, grout);
  col *= 1. - craze * 0.3;
  // chipped corners
  vec2 cc = min(f, 1. - f); float corner = 1. - smoothstep(0.03, 0.06, length(cc));
  float chipped = corner * step(0.9, hash12(mod(id, vec2(N)) * 4.1));
  col = mix(col, srgb(vec3(.85, .82, .76)), chipped);
  m.alb = col;
  m.h = bevel * (1. - grout) * (1. - chipped * 0.6) + wav * 0.03 - craze * 0.05;
  m.rough = mix(mix(0.09, 0.18, rnd), 0.92, grout) + craze * 0.25 + chipped * 0.5;
  m.ao = mix(1.0, 0.55, grout);
  return m;
}`};

// Painted plaster (roller stipple, patched areas, hairline cracks). uTint = paint colour.
MATS.plaster = { world: 2.0, height: 0.0012, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float stip = fbm(uv * 90., vec2(90.), 3);
  float big = fbm(uv * 3., vec2(3.), 4);
  float patch = smoothstep(0.62, 0.66, fbm(uv * 4. + 7.3, vec2(4.), 3));
  vec3 col = uTint * (0.95 + 0.07 * big) * (0.985 + 0.03 * stip);
  col *= mix(vec3(1.), vec3(1.03, 1.02, 0.99), patch);
  vec4 v = voronoi(uv * 5., vec2(5.));
  float crackMask = smoothstep(0.55, 0.75, fbm(uv * 2.0 + 3.1, vec2(2.), 3));
  float crack = (1. - smoothstep(0.0, 0.004, v.w)) * crackMask;
  col *= 1. - crack * 0.25;
  m.alb = col;
  m.h = 0.5 + (stip - 0.5) * 0.25 + patch * 0.08 - crack * 0.25;
  m.rough = 0.82 - patch * 0.08 + stip * 0.05;
  return m;
}`};

// Board-formed concrete: 0.15 m boards, wood-grain imprint, tie holes, bug holes,
// efflorescence. uTint = cement tone.
MATS.concrete = { world: 2.4, height: 0.006, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float B = 16.;
  float by = uv.y * B; float bid = floor(by); float bf = fract(by);
  float seam = 1. - smoothstep(0.0, 0.05, min(bf, 1. - bf));
  float off = hash11(mod(bid, B) * 1.37 + uSeed);
  vec2 gp = vec2(uv.x * 2. + off, by);
  float grain = fbm(vec2(gp.x * 3.0, gp.y * 9.0), vec2(6.0, B * 9.0), 5);
  float rings = sin((gp.y * 9. + grain * 6.) * 3.0) * 0.5 + 0.5;
  vec2 tg = fract(uv * 4. + vec2(0.5, 0.5)) - 0.5;
  float hole = 1. - smoothstep(0.016, 0.022, length(tg * vec2(1.0, 1.0)));
  float holeRim = (1. - smoothstep(0.022, 0.03, length(tg))) - hole;
  vec4 v = voronoi(uv * 140., vec2(140.));
  float bug = (1. - smoothstep(0.05, 0.12, v.x)) * step(0.72, v.z);
  float mott = fbm(uv * 4., vec2(4.), 5);
  vec3 col = uTint * (0.84 + 0.18 * hash11(mod(bid, B) * 2.71)) * (0.82 + 0.3 * mott) * (0.95 + 0.08 * rings);
  float efflo = smoothstep(0.55, 0.8, fbm(vec2(uv.x * 6., uv.y * 2.), vec2(6., 2.), 4)) * smoothstep(0.6, 1.0, bf);
  col = mix(col, srgb(vec3(.80, .79, .76)), efflo * 0.35);
  col *= 1. - seam * 0.18;
  col *= 1. - hole * 0.6; col *= 1. - bug * 0.5;
  m.alb = col;
  m.h = 0.5 + (grain - 0.5) * 0.35 + rings * 0.05 + seam * 0.25 - hole * 0.6 + holeRim * 0.1 - bug * 0.4;
  m.rough = 0.88 + 0.08 * mott - efflo * 0.05;
  m.ao = 1. - hole * 0.5 - bug * 0.3;
  return m;
}`};

// Power-trowelled concrete floor: mottling, saw-cut joints at the tile edges, stains.
MATS.slab = { world: 3.0, height: 0.003, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float mott = fbm(uv * 3., vec2(3.), 6);
  float swirl = fbm(uv * 9. + vec2(fbm(uv * 2., vec2(2.), 3) * 2.), vec2(9.), 4);
  vec3 col = uTint * (0.8 + 0.32 * mott) * (0.96 + 0.08 * swirl);
  vec2 e = min(uv, 1. - uv); float joint = 1. - smoothstep(0.0012, 0.0025, min(e.x, e.y));
  float stain = smoothstep(0.6, 0.75, fbm(uv * 2.5 + 11.0, vec2(2.5), 5));
  col *= 1. - stain * 0.18;
  vec4 v = voronoi(uv * 3., vec2(3.));
  float crack = (1. - smoothstep(0.0, 0.003, v.w)) * smoothstep(0.62, 0.7, fbm(uv * 1.5 + 5.0, vec2(1.5), 3));
  col *= 1. - joint * 0.5 - crack * 0.35;
  float scr = scratches(uv, 6., 0.7);
  m.alb = col * (1. + scr * 0.04);
  m.h = 0.5 + (swirl - 0.5) * 0.08 - joint * 0.5 - crack * 0.3;
  m.rough = mix(0.55, 0.85, mott) - stain * 0.1 + joint * 0.2 + scr * 0.1;
  return m;
}`};

// Sheet linoleum, marbled, with a seam on the texture edge. uTint = base colour.
MATS.lino = { world: 2.0, height: 0.0008, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  vec2 w = vec2(fbm(uv * vec2(2., 6.), vec2(2., 6.), 4), fbm(uv * vec2(2., 6.) + 4.2, vec2(2., 6.), 4));
  float marb = fbm(vec2(uv.x * 4. + w.x * 2.0, uv.y * 16. + w.y * 3.0), vec2(4., 16.), 5);
  vec3 col = uTint * (0.78 + 0.4 * marb);
  col = mix(col, uTint2, smoothstep(0.62, 0.8, marb) * 0.5);
  float seam = 1. - smoothstep(0.0, 0.0018, uv.x) * smoothstep(0.0, 0.0018, 1. - uv.x);
  float wax = fbm(uv * 7., vec2(7.), 3);
  float scuff = scratches(uv, 10., 0.4);
  m.alb = col * (1. - seam * 0.4) * (1. - scuff * 0.08);
  m.h = 0.5 - seam * 0.6 + marb * 0.03;
  m.rough = mix(0.32, 0.55, wax) + scuff * 0.2;
  return m;
}`};

// Oak planks / boards along X. uTint = wood tone.
MATS.planks = { world: 2.0, height: 0.002, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float P = 12.;
  float py = uv.y * P; float pid = floor(py); float pf = fract(py);
  float len = 0.5;
  float px = uv.x / len + hash11(mod(pid, P) * 3.7 + uSeed) * 7.0;
  float seg = floor(px); float sf = fract(px);
  float id = hash12(vec2(mod(pid, P), mod(seg, 1.0 / len)) + uSeed);
  float gap = 1. - smoothstep(0.0, 0.03, min(pf, 1. - pf));
  float endGap = 1. - smoothstep(0.0, 0.004, min(sf, 1. - sf));
  float warp = fbm(vec2(uv.x * 2.0, py * 1.0 + id * 9.), vec2(2.0, P), 4);
  float ring = fract((pf + warp * 0.9 + id * 3.) * (5.0 + id * 4.0));
  float grain = smoothstep(0.0, 0.25, ring) * smoothstep(1.0, 0.6, ring);
  float pores = fbm(vec2(uv.x * 160., py * 8.), vec2(160., P * 8.), 2);
  vec3 col = uTint * (0.72 + 0.4 * id) * (0.8 + 0.25 * grain) * (0.92 + 0.12 * pores);
  col *= 1. - (gap + endGap) * 0.6;
  float wear = fbm(uv * 3., vec2(3.), 3);
  m.alb = col;
  m.h = 0.6 - gap * 0.6 - endGap * 0.5 + grain * 0.04 - pores * 0.03;
  m.rough = mix(0.38, 0.62, wear) + pores * 0.1;
  return m;
}`};

// Vertical oak veneer panelling with book-matched leaves. uTint = wood tone.
MATS.veneer = { world: 1.2, height: 0.0006, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float L = 4.;
  float lx = uv.x * L; float lid = floor(lx); float lf = fract(lx);
  float mirrored = mod(lid, 2.0) < 1.0 ? lf : 1.0 - lf;
  float warp = fbm(vec2(mirrored * 1.5, uv.y * 3.0), vec2(1.5 * 1.0, 3.0), 4);
  float ring = fract((mirrored * 3.0 + warp * 1.6) * 6.0);
  float figure = smoothstep(0.1, 0.3, ring) * smoothstep(0.9, 0.5, ring);
  float pores = fbm(vec2(mirrored * 20., uv.y * 220.), vec2(20., 220.), 2);
  float joint = 1. - smoothstep(0.0, 0.004, min(lf, 1. - lf));
  vec3 col = uTint * (0.8 + 0.25 * figure) * (0.93 + 0.1 * pores);
  col *= 1. - joint * 0.35;
  m.alb = col;
  m.h = 0.5 + figure * 0.05 - joint * 0.4;
  m.rough = 0.42 + pores * 0.12;
  return m;
}`};

// Enamel-painted steel with chips through to primer and bare metal.
// uTint = paint colour, uParam = amount of wear (0..1).
MATS.paint = { world: 1.0, height: 0.0008, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float peel = fbm(uv * 60., vec2(60.), 2);
  float n = fbm(uv * 5., vec2(5.), 5);
  float chipN = fbm(uv * 12., vec2(12.), 5);
  float thr = mix(0.86, 0.66, uParam);
  float chip = smoothstep(thr, thr + 0.02, chipN);
  float primerRim = smoothstep(thr - 0.04, thr, chipN) - chip;
  float bare = smoothstep(thr + 0.05, thr + 0.07, chipN);
  float scr = scratches(uv, 8., 0.5) * uParam;
  vec3 paint = uTint * (0.9 + 0.14 * n);
  vec3 primer = srgb(vec3(.42, .22, .16));
  vec3 steel = srgb(vec3(.42, .42, .43)) * (0.8 + 0.3 * n);
  vec3 col = mix(paint, primer, max(primerRim * 0.7, chip));
  col = mix(col, steel, max(bare, scr * 0.8));
  float grime = smoothstep(0.4, 0.9, fbm(uv * 3. + 2.0, vec2(3.), 4)) * uParam;
  col *= 1. - grime * 0.25;
  m.alb = col;
  m.metal = max(bare, scr * 0.8);
  m.h = 0.5 + peel * 0.08 - chip * 0.35 - bare * 0.1 - scr * 0.2;
  m.rough = mix(0.32 + 0.12 * n, 0.75, chip) - bare * 0.35 + grime * 0.15;
  return m;
}`};

// Worn, brushed steel.
MATS.steel = { world: 1.0, height: 0.0004, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float brush = fbm(vec2(uv.x * 2., uv.y * 300.), vec2(2., 300.), 3);
  float smudge = fbm(uv * 4., vec2(4.), 4);
  float scr = scratches(uv, 12., 0.5);
  m.alb = uTint * (0.75 + 0.2 * brush) * (0.85 + 0.2 * smudge);
  m.metal = 1.;
  m.rough = 0.28 + 0.2 * smudge + brush * 0.08 + scr * 0.1;
  m.h = 0.5 + brush * 0.04 - scr * 0.2;
  return m;
}`};

// Rusted iron (chains, old machinery, the dam's gates).
MATS.rust = { world: 1.0, height: 0.003, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float n = fbm(uv * 6., vec2(6.), 6);
  float flake = ridged(uv * 10., vec2(10.), 4);
  vec3 a = srgb(vec3(.36, .17, .09)), b = srgb(vec3(.60, .33, .15)), c = srgb(vec3(.18, .14, .12));
  vec3 col = mix(a, b, smoothstep(0.35, 0.7, n));
  col = mix(col, c, smoothstep(0.62, 0.8, flake) * 0.8);
  m.alb = col * uTint;
  m.metal = smoothstep(0.7, 0.85, flake) * 0.4;
  m.rough = 0.82 + 0.15 * n;
  m.h = 0.5 + flake * 0.4 + n * 0.1;
  return m;
}`};

// Handled brass: tarnish in the low spots, bright where touched.
MATS.brass = { world: 0.5, height: 0.0003, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float n = fbm(uv * 5., vec2(5.), 5);
  float t = smoothstep(0.45, 0.75, n);
  float scr = scratches(uv, 14., 0.4);
  vec3 bright = srgb(vec3(.82, .66, .38)), tarnish = srgb(vec3(.38, .30, .17));
  m.alb = mix(bright, tarnish, t * 0.7) * uTint;
  m.metal = 1.;
  m.rough = mix(0.22, 0.52, t) + scr * 0.08;
  m.h = 0.5 - scr * 0.3;
  return m;
}`};

// Black rubber matting with raised coin studs (weighing plates, booth floors).
MATS.rubber = { world: 0.5, height: 0.003, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float N = 14.;
  vec2 f = fract(uv * N) - 0.5;
  float d = length(f);
  float stud = 1. - smoothstep(0.22, 0.26, d);
  float wear = fbm(uv * 4., vec2(4.), 4);
  vec3 col = uTint * (0.85 + 0.25 * wear);
  col = mix(col, col * 1.25 + 0.01, stud * smoothstep(0.4, 0.8, wear));
  m.alb = col;
  m.h = 0.3 + stud * 0.6;
  m.rough = 0.72 - stud * 0.15 * wear;
  return m;
}`};

// Steel bar grating with alpha cut-outs.
MATS.grating = { world: 0.6, height: 0.004, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float nx = 20., ny = 6.;
  vec2 f = fract(uv * vec2(nx, ny));
  float barA = 1. - smoothstep(0.08, 0.12, min(f.x, 1. - f.x));
  float barB = 1. - smoothstep(0.03, 0.05, min(f.y, 1. - f.y));
  float solid = max(barA, barB);
  float n = fbm(uv * 8., vec2(8.), 4);
  m.alb = uTint * (0.7 + 0.35 * n);
  m.metal = 0.6; m.rough = 0.5 + 0.3 * n;
  m.h = solid; m.alpha = solid;
  return m;
}`};

// Rubble stone masonry with lime mortar (the drowned village).
MATS.stone = { world: 2.0, height: 0.03, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  vec2 p = uv * vec2(5., 8.);
  vec4 v = voronoi(p, vec2(5., 8.));
  float mortar = 1. - smoothstep(0.03, 0.08, v.w);
  float id = v.z;
  vec3 c1 = srgb(vec3(.52, .50, .46)), c2 = srgb(vec3(.47, .40, .32)), c3 = srgb(vec3(.60, .55, .45));
  vec3 stoneCol = id < .4 ? c1 : (id < .75 ? c2 : c3);
  float n = fbm(uv * 12., vec2(12.), 5);
  stoneCol *= 0.75 + 0.45 * n;
  vec3 mortarCol = srgb(vec3(.66, .63, .57)) * (0.8 + 0.3 * n);
  m.alb = mix(stoneCol, mortarCol, mortar) * uTint;
  float bulge = smoothstep(0.0, 0.25, v.w);
  m.h = bulge * 0.8 * (1. - mortar) + n * 0.15;
  m.rough = mix(0.8, 0.95, mortar);
  m.ao = 1. - mortar * 0.4;
  return m;
}`};

// Lime render / whitewash over stone, flaking at the bottom.
MATS.render = { world: 2.0, height: 0.004, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float n = fbm(uv * 6., vec2(6.), 6);
  float flake = smoothstep(0.66, 0.7, fbm(uv * 5. + 3.3, vec2(5.), 5));
  vec4 v = voronoi(uv * vec2(5., 8.), vec2(5., 8.));
  float mortar = 1. - smoothstep(0.03, 0.08, v.w);
  vec3 stoneCol = srgb(vec3(.50, .46, .40)) * (0.8 + 0.3 * n);
  stoneCol = mix(stoneCol, srgb(vec3(.62, .60, .55)), mortar);
  vec3 wash = uTint * (0.88 + 0.14 * n);
  float streak = fbm(vec2(uv.x * 30., uv.y * 2.), vec2(30., 2.), 3);
  wash *= 1. - smoothstep(0.55, 0.8, streak) * 0.15;
  m.alb = mix(wash, stoneCol, flake);
  m.h = 0.6 + n * 0.1 - flake * 0.4 + flake * (1. - mortar) * 0.2;
  m.rough = 0.92;
  return m;
}`};

// Clay roof tiles in overlapping rows.
MATS.rooftiles = { world: 2.0, height: 0.03, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float R = 10., C = 8.;
  float ry = uv.y * R; float rid = floor(ry); float rf = fract(ry);
  float cx = uv.x * C + mod(rid, 2.0) * 0.5; float cid = floor(cx); float cf = fract(cx);
  float id = hash12(vec2(mod(cid, C), mod(rid, R)) + uSeed);
  float curve = sin(cf * PI);
  float lip = smoothstep(0.75, 1.0, rf);
  vec3 col = uTint * (0.75 + 0.4 * id) * (0.85 + 0.2 * curve);
  float moss = smoothstep(0.62, 0.75, fbm(uv * 4., vec2(4.), 5)) * (1. - curve * 0.5);
  col = mix(col, srgb(vec3(.30, .34, .20)), moss * 0.7);
  col *= 1. - (1. - smoothstep(0.0, 0.08, rf)) * 0.45;
  m.alb = col;
  m.h = curve * 0.6 + rf * 0.4 - (1. - smoothstep(0.0, 0.05, rf)) * 0.5;
  m.rough = 0.75 + moss * 0.2;
  return m;
}`};

// Common brick, running bond. uTint = brick colour.
MATS.brick = { world: 0.9, height: 0.006, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float rows = 12., cols = 4.;
  float ry = uv.y * rows; float rid = floor(ry); float rf = fract(ry);
  float cx = uv.x * cols + mod(rid, 2.0) * 0.5; float cid = floor(cx); float cf = fract(cx);
  float id = hash12(vec2(mod(cid, cols), mod(rid, rows)) + uSeed);
  float mortar = 1. - smoothstep(0.0, 0.06, min(rf, 1. - rf)) * smoothstep(0.0, 0.02, min(cf, 1. - cf));
  float n = fbm(uv * 20., vec2(20.), 4);
  vec3 col = uTint * (0.75 + 0.4 * id) * (0.85 + 0.25 * n);
  col = mix(col, srgb(vec3(.58, .56, .52)) * (0.8 + 0.3 * n), mortar);
  m.alb = col;
  m.h = 0.7 * (1. - mortar) + n * 0.1;
  m.rough = 0.85;
  m.ao = 1. - mortar * 0.3;
  return m;
}`};

// Cobblestones (village lanes).
MATS.cobbles = { world: 2.0, height: 0.03, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  vec4 v = voronoi(uv * 9., vec2(9.));
  float gap = 1. - smoothstep(0.04, 0.12, v.w);
  float n = fbm(uv * 20., vec2(20.), 4);
  vec3 col = uTint * (0.7 + 0.45 * v.z) * (0.85 + 0.2 * n);
  col = mix(col, srgb(vec3(.22, .20, .16)), gap);
  m.alb = col;
  m.h = smoothstep(0.0, 0.3, v.w) * 0.9;
  m.rough = mix(0.55, 0.95, gap) + n * 0.1;
  m.ao = 1. - gap * 0.5;
  return m;
}`};

// Wet lake-bed mud with stones and puddles.
MATS.mud = { world: 3.0, height: 0.02, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float n = fbm(uv * 5., vec2(5.), 6);
  vec4 v = voronoi(uv * 24., vec2(24.));
  float stone = (1. - smoothstep(0.18, 0.3, v.x)) * step(0.7, v.z);
  float puddle = smoothstep(0.58, 0.62, fbm(uv * 3. + 1.7, vec2(3.), 5));
  vec3 col = uTint * (0.7 + 0.4 * n);
  col = mix(col, srgb(vec3(.45, .43, .40)) * (0.7 + 0.5 * v.z), stone);
  col *= 1. - puddle * 0.35;
  m.alb = col;
  m.h = 0.4 + n * 0.3 + stone * 0.3 - puddle * 0.3;
  m.rough = mix(0.7, 0.06, puddle) - stone * 0.1;
  return m;
}`};

// Wired safety glass (alpha).
MATS.wiredglass = { world: 0.5, height: 0.0005, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  vec2 f = fract(uv * 20.);
  float wire = 1. - smoothstep(0.02, 0.05, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
  float dirt = fbm(uv * 4., vec2(4.), 4);
  m.alb = mix(uTint, srgb(vec3(.25, .25, .24)), wire);
  m.alpha = mix(0.18 + dirt * 0.12, 0.9, wire);
  m.metal = wire * 0.8;
  m.rough = mix(0.06 + dirt * 0.15, 0.4, wire);
  m.h = 0.5 + wire * 0.3;
  return m;
}`};

// Bakelite (instrument grips, switches, telephones).
MATS.bakelite = { world: 0.25, height: 0.0002, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float n = fbm(uv * vec2(3., 12.) + vec2(fbm(uv * 3., vec2(3.), 3), 0.), vec2(3., 12.), 5);
  m.alb = uTint * (0.7 + 0.5 * n);
  m.rough = 0.22 + 0.15 * fbm(uv * 20., vec2(20.), 2);
  m.h = 0.5;
  return m;
}`};

// Woven wool / twill fabric (clothing, upholstery).
MATS.fabric = { world: 0.12, height: 0.0006, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float N = 48.;
  vec2 g = uv * N;
  float tw = fract(g.x + g.y * 0.5);
  float weave = smoothstep(0.1, 0.5, tw) * smoothstep(1.0, 0.6, tw);
  float fuzz = fbm(uv * 90., vec2(90.), 3);
  float n = fbm(uv * 4., vec2(4.), 4);
  m.alb = uTint * (0.85 + 0.2 * weave) * (0.92 + 0.12 * fuzz) * (0.95 + 0.08 * n);
  m.h = weave * 0.6 + fuzz * 0.3;
  m.rough = 0.9;
  return m;
}`};

// Glove leather.
MATS.leather = { world: 0.2, height: 0.0006, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  vec4 v = voronoi(uv * 40., vec2(40.));
  float crease = 1. - smoothstep(0.0, 0.06, v.w);
  float n = fbm(uv * 6., vec2(6.), 5);
  float worn = smoothstep(0.5, 0.8, n);
  m.alb = uTint * (0.85 + 0.25 * n) * (1. - crease * 0.25) * (1. + worn * 0.25);
  m.h = 0.5 - crease * 0.4 + n * 0.1;
  m.rough = 0.52 + crease * 0.2 - worn * 0.12;
  return m;
}`};

// Old paper (notes, ledgers, posters).
MATS.paper = { world: 0.4, height: 0.0002, body: /* glsl */`
M mat(vec2 uv) {
  M m = newM();
  float fib = fbm(uv * vec2(80., 20.), vec2(80., 20.), 3);
  float fox = smoothstep(0.65, 0.8, fbm(uv * 6., vec2(6.), 5));
  m.alb = uTint * (0.94 + 0.06 * fib) * mix(vec3(1.), vec3(0.85, 0.72, 0.52), fox * 0.5);
  m.h = 0.5 + fib * 0.1;
  m.rough = 0.92;
  return m;
}`};

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const MAIN = /* glsl */`
void main() {
  M m = mat(vUv);
  if (uMode == 0) {
    gl_FragColor = vec4(clamp(m.alb, 0.0, 1.0), m.alpha);
  } else if (uMode == 1) {
    float e = uTexel.x;
    float hl = mat(vUv - vec2(e, 0.)).h, hr = mat(vUv + vec2(e, 0.)).h;
    float hd = mat(vUv - vec2(0., e)).h, hu = mat(vUv + vec2(0., e)).h;
    vec3 n = normalize(vec3((hl - hr) * uNormalStrength, (hd - hu) * uNormalStrength, 1.0));
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
  } else {
    gl_FragColor = vec4(clamp(m.ao, 0., 1.), clamp(m.rough, 0.03, 1.), clamp(m.metal, 0., 1.), 1.0);
  }
}`;

const toLin = c => new THREE.Color(c).convertSRGBToLinear();

export class TexGen {
  constructor(renderer, { size = 1024 } = {}) {
    this.renderer = renderer;
    this.size = size;
    this.cache = new Map();
    this.programs = new Map();
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  static has(name) { return !!MATS[name]; }
  static worldSize(name) { return MATS[name]?.world ?? 1; }

  program(name) {
    if (this.programs.has(name)) return this.programs.get(name);
    const def = MATS[name];
    if (!def) throw new Error('unknown material ' + name);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: LIB + def.body + MAIN,
      uniforms: {
        uMode: { value: 0 }, uSeed: { value: 0 }, uTexel: { value: new THREE.Vector2() },
        uTint: { value: new THREE.Color(1, 1, 1) }, uTint2: { value: new THREE.Color(0.5, 0.5, 0.5) },
        uNormalStrength: { value: 1 }, uParam: { value: 0.5 },
      },
      depthTest: false, depthWrite: false,
    });
    this.programs.set(name, mat);
    return mat;
  }

  // Returns { map, normalMap, ormMap, world } for a material variant.
  get(name, { tint = '#ffffff', tint2 = '#808080', seed = 1, param = 0.5, size = null } = {}) {
    const sz = size || Math.min(this.size, name === 'fabric' || name === 'leather' || name === 'bakelite' || name === 'brass' ? 512 : this.size);
    const key = `${name}|${tint}|${tint2}|${seed}|${param}|${sz}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const def = MATS[name];
    const mat = this.program(name);
    const u = mat.uniforms;
    u.uSeed.value = seed * 7.13;
    u.uTexel.value.set(1 / sz, 1 / sz);
    u.uTint.value.copy(toLin(tint));
    u.uTint2.value.copy(toLin(tint2));
    u.uParam.value = param;
    const texelMeters = def.world / sz;
    u.uNormalStrength.value = def.height / texelMeters;
    this.quad.material = mat;

    const make = (srgb) => {
      const rt = new THREE.WebGLRenderTarget(sz, sz, {
        type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
        colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
        generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false,
      });
      rt.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 4;
      return rt;
    };
    const prevRT = this.renderer.getRenderTarget();
    const out = {};
    const passes = [['map', 0, true], ['normalMap', 1, false], ['ormMap', 2, false]];
    for (const [slot, mode, srgb] of passes) {
      const rt = make(srgb);
      u.uMode.value = mode;
      this.renderer.setRenderTarget(rt);
      this.renderer.render(this.scene, this.camera);
      out[slot] = rt.texture;
      out[slot + 'RT'] = rt;
    }
    this.renderer.setRenderTarget(prevRT);
    out.world = def.world;
    this.cache.set(key, out);
    return out;
  }

  dispose() {
    for (const v of this.cache.values()) for (const k of ['mapRT', 'normalMapRT', 'ormMapRT']) v[k]?.dispose();
    this.cache.clear();
    for (const p of this.programs.values()) p.dispose();
    this.programs.clear();
  }
}
