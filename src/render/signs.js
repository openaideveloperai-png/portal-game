// Canvas-painted textures: numeral drums, dial faces, enamel signs, stencils, posters,
// labels. Everything is drawn with small deliberate imperfections — ink spread, uneven
// enamel, worn edges — because printed things in old buildings are never pristine.
import * as THREE from 'three';
import { rng, hashString } from '../core/util.js';

export const FONTS = {
  sign: '"Barlow Condensed", "Arial Narrow", sans-serif',
  type: '"Courier Prime", "Courier New", monospace',
  serif: '"Old Standard TT", Georgia, serif',
  hand: '"Reenie Beanie", cursive',
  script: '"La Belle Aurore", cursive',
};

export const INK = '#1d1b19';
export const RED_INK = '#a3281c';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

// Grain/noise overlay so flat fills look printed or painted.
function speckle(ctx, w, h, seed, amount = 0.05, size = 1) {
  const r = rng(seed);
  const n = Math.floor(w * h * 0.004 * amount * 20);
  for (let i = 0; i < n; i++) {
    const a = r() * amount;
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`;
    ctx.fillRect(r() * w, r() * h, size + r() * size, size + r() * size);
  }
}

function wearEdges(ctx, w, h, seed, amount = 0.5, color = 'rgba(40,30,20,') {
  const r = rng(seed);
  for (let i = 0; i < 60 * amount; i++) {
    const side = Math.floor(r() * 4);
    const t = r();
    const x = side === 0 ? t * w : side === 1 ? w - r() * 8 : side === 2 ? t * w : r() * 8;
    const y = side === 0 ? r() * 8 : side === 1 ? t * h : side === 2 ? h - r() * 8 : t * h;
    ctx.fillStyle = color + (0.1 + r() * 0.35) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 10 * amount, 1 + r() * 4, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------- numeral drum strip
// A vertical strip of cells, value v at cell index (v - DRUM_MIN). Cylinder shading baked.
export const DRUM_MIN = -9, DRUM_MAX = 12;
export function drumTexture() {
  if (cache.has('drum')) return cache.get('drum');
  const cells = DRUM_MAX - DRUM_MIN + 1;
  const W = 128, CH = 128;
  const c = canvas(W, CH * cells);
  const ctx = c.getContext('2d');
  for (let i = 0; i < cells; i++) {
    const v = DRUM_MIN + i;
    // drum is drawn top-to-bottom with higher numbers above, so uv offset increases with v
    const y = (cells - 1 - i) * CH;
    const g = ctx.createLinearGradient(0, y, 0, y + CH);
    g.addColorStop(0, '#bdb39b'); g.addColorStop(0.18, '#e9e1cb'); g.addColorStop(0.5, '#f1ead6'); g.addColorStop(0.82, '#e5dcc4'); g.addColorStop(1, '#b4aa92');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, CH);
    ctx.fillStyle = v < 0 ? RED_INK : INK;
    ctx.font = `600 ${v <= -10 || v >= 10 ? 74 : 92}px ${FONTS.sign}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = v < 0 ? '−' + Math.abs(v) : String(v);
    ctx.fillText(label, W / 2 + (v < 0 ? -3 : 0), y + CH / 2 + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, W, 2);
  }
  speckle(ctx, W, CH * cells, 11, 0.06);
  const t = tex(c);
  t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  const out = { texture: t, cells };
  cache.set('drum', out);
  return out;
}
// UV offset (in v) that centres value v in a window showing `span` cells.
export function drumOffset(v, span = 1) {
  const cells = DRUM_MAX - DRUM_MIN + 1;
  const i = v - DRUM_MIN;
  return (i + 0.5 - span / 2) / cells;
}

// ---------------------------------------------------------------- dial faces
// Round gauge face. ticks from min..max over an arc; a target zone may be painted.
export function dialTexture({ min = 0, max = 8, need = null, exact = false, label = 'MEASURES', size = 512, zero = null } = {}) {
  const key = `dial${min}${max}${need}${exact}${label}${size}${zero}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size), ctx = c.getContext('2d');
  const cx = size / 2, cy = size / 2, R = size * 0.47;
  const face = ctx.createRadialGradient(cx, cy * 0.9, R * 0.1, cx, cy, R);
  face.addColorStop(0, '#f2ead4'); face.addColorStop(1, '#ddd2b6');
  ctx.fillStyle = '#2b2722'; ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const ang = v => a0 + (v - min) / (max - min) * (a1 - a0);
  if (need !== null) {
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = 'rgba(86,118,82,0.85)';
    ctx.beginPath();
    if (exact) ctx.arc(cx, cy, R * 0.8, ang(need - 0.35), ang(need + 0.35));
    else ctx.arc(cx, cy, R * 0.8, ang(need - 0.25), ang(max));
    ctx.stroke();
    if (min < 0) { ctx.strokeStyle = 'rgba(163,40,28,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, ang(min), ang(Math.min(0, need) - 0.3)); ctx.stroke(); }
  } else if (min < 0) {
    ctx.lineWidth = size * 0.035; ctx.strokeStyle = 'rgba(163,40,28,0.6)';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, ang(min), ang(0) - 0.02); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.fillStyle = INK;
  for (let v = min; v <= max; v++) {
    const a = ang(v);
    ctx.lineWidth = size * 0.012;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86); ctx.lineTo(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97); ctx.stroke();
    if (v < max) {
      ctx.lineWidth = size * 0.005;
      const am = ang(v + 0.5);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(am) * R * 0.91, cy + Math.sin(am) * R * 0.91); ctx.lineTo(cx + Math.cos(am) * R * 0.97, cy + Math.sin(am) * R * 0.97); ctx.stroke();
    }
    ctx.font = `600 ${size * 0.1}px ${FONTS.sign}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = v < 0 ? RED_INK : INK;
    ctx.fillText(v < 0 ? '−' + -v : String(v), cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66 + size * 0.008);
  }
  ctx.fillStyle = INK;
  ctx.font = `500 ${size * 0.055}px ${FONTS.sign}`;
  ctx.fillText(label, cx, cy + R * 0.42);
  if (need !== null) { ctx.font = `600 ${size * 0.075}px ${FONTS.sign}`; ctx.fillText((exact ? '= ' : '≥ ') + need, cx, cy + R * 0.25); }
  ctx.font = `italic ${size * 0.04}px ${FONTS.serif}`;
  ctx.fillStyle = 'rgba(29,27,25,0.7)';
  ctx.fillText('Inst. Pond. Mens.', cx, cy - R * 0.3);
  speckle(ctx, size, size, 7, 0.05);
  const t = tex(c);
  const out = { texture: t, angle: v => -(ang(v) - Math.PI * 1.5) };
  cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- enamel / painted signs
// style: 'enamel' (white on colour, rounded, chipped), 'stencil' (sprayed letters on wall),
// 'plate' (engraved brass/aluminium), 'paper' (printed notice), 'flip' (split-flap)
export function signTexture(lines, { style = 'enamel', bg = '#2f4a3f', fg = '#ece4cf', w = 1024, h = 256, font = FONTS.sign, weight = 600, size = null, align = 'center', seed = null, sub = null } = {}) {
  const key = 'sign' + JSON.stringify([lines, style, bg, fg, w, h, weight, size, align, sub]);
  if (cache.has(key)) return cache.get(key);
  const s = seed ?? hashString(key);
  const r = rng(s);
  const c = canvas(w, h), ctx = c.getContext('2d');
  lines = [].concat(lines);
  if (style === 'enamel') {
    ctx.fillStyle = '#1a1816'; ctx.fillRect(0, 0, w, h);
    const pad = h * 0.04, rad = h * 0.08;
    ctx.fillStyle = bg; roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, rad); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = h * 0.02; roundRect(ctx, pad * 2.6, pad * 2.6, w - pad * 5.2, h - pad * 5.2, rad * 0.7); ctx.stroke();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (style === 'plate') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -0.18));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`; ctx.fillRect(0, r() * h, w, 1); }
  } else if (style === 'paper') {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, s, 0.08);
  } else if (style === 'stencil') {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  }
  const n = lines.length + (sub ? 0.6 : 0);
  const fs = size || Math.min(h * 0.62 / n, w * 0.9 / Math.max(...lines.map(l => l.length)) * 1.9);
  ctx.font = `${weight} ${fs}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const x = align === 'center' ? w / 2 : align === 'left' ? w * 0.08 : w * 0.92;
  const lh = fs * 1.08;
  const y0 = h / 2 - (lh * (n - 1)) / 2;
  lines.forEach((line, i) => {
    const y = y0 + i * lh;
    if (style === 'stencil') {
      // overspray halo then the paint
      ctx.save(); ctx.filter = 'blur(3px)'; ctx.fillStyle = fg.replace(/^#(..)(..)(..)$/, (m, a, b, c2) => `rgba(${parseInt(a, 16)},${parseInt(b, 16)},${parseInt(c2, 16)},0.25)`);
      ctx.fillText(line, x, y); ctx.restore();
      ctx.fillStyle = fg; ctx.fillText(line, x + (r() - 0.5) * 2, y);
      // drips
      for (let k = 0; k < 4; k++) {
        if (r() < 0.6) continue;
        const dx = x + (r() - 0.5) * ctx.measureText(line).width;
        ctx.fillRect(dx, y + fs * 0.35, 2 + r() * 2, 6 + r() * fs * 0.6);
      }
    } else if (style === 'plate') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText(line, x + 1.5, y + 1.5);
      ctx.fillStyle = fg; ctx.fillText(line, x, y);
    } else {
      ctx.fillStyle = fg; ctx.fillText(line, x, y);
    }
  });
  if (sub) {
    ctx.font = `${weight - 100} ${fs * 0.42}px ${font}`;
    ctx.fillStyle = fg; ctx.globalAlpha = 0.85;
    ctx.fillText(sub, x, y0 + lines.length * lh - lh * 0.15);
    ctx.globalAlpha = 1;
  }
  if (style === 'enamel') {
    // chips: dark iron showing through, mostly near edges and screw holes
    for (let i = 0; i < 26; i++) {
      const edge = r() < 0.7;
      const px = edge ? (r() < 0.5 ? r() * w * 0.08 : w - r() * w * 0.08) : r() * w;
      const py = edge ? r() * h : (r() < 0.5 ? r() * h * 0.12 : h - r() * h * 0.12);
      const rad = 2 + r() * h * 0.035;
      ctx.fillStyle = '#211d19';
      ctx.beginPath(); ctx.ellipse(px, py, rad, rad * (0.5 + r()), r() * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,70,40,0.5)';
      ctx.beginPath(); ctx.ellipse(px + 1, py + rad * 0.8, rad * 0.4, rad * 1.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const [sx, sy] of [[0.04, 0.5], [0.96, 0.5]]) {
      ctx.fillStyle = '#6f675c'; ctx.beginPath(); ctx.arc(w * sx, h * sy, h * 0.035, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * sx - h * 0.02, h * sy); ctx.lineTo(w * sx + h * 0.02, h * sy); ctx.stroke();
    }
    speckle(ctx, w, h, s + 1, 0.06);
  } else if (style === 'paper') {
    wearEdges(ctx, w, h, s, 0.6);
  } else if (style === 'stencil') {
    // eat into the paint with noise so it reads as sprayed on rough concrete
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && r() < 0.18) d[i + 3] *= r();
    ctx.putImageData(id, 0, 0);
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------------------------------------------------------------- posters
// Period public-information posters: flat colour fields, condensed type, a simple motif.
export function posterTexture(kind, seed = 1) {
  const key = 'poster' + kind + seed;
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = 720;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const r = rng(seed * 31 + 7);
  const P = POSTERS[kind] || POSTERS.measure;
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  P.draw(ctx, W, H, r);
  ctx.fillStyle = P.fg;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${P.size || 78}px ${FONTS.sign}`;
  P.title.forEach((l, i) => ctx.fillText(l, 36, H - 150 + i * (P.size || 78) * 0.95 - (P.title.length - 1) * (P.size || 78) * 0.95));
  ctx.font = `500 26px ${FONTS.sign}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(P.sub, 38, H - 70);
  ctx.font = `italic 18px ${FONTS.serif}`;
  ctx.fillText('State Institute of Ponderal Measures · Kalden', 38, H - 36);
  ctx.globalAlpha = 1;
  // age: yellowing, fold lines, tape, faded corner
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(120,90,40,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H / 2 + r() * 6); ctx.lineTo(W, H / 2 - r() * 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2 + r() * 4, H); ctx.stroke();
  ctx.fillStyle = 'rgba(230,220,190,0.55)';
  ctx.save(); ctx.translate(30, 18); ctx.rotate(-0.3); ctx.fillRect(-30, -10, 80, 26); ctx.restore();
  ctx.save(); ctx.translate(W - 30, 18); ctx.rotate(0.35); ctx.fillRect(-50, -10, 80, 26); ctx.restore();
  speckle(ctx, W, H, seed, 0.1, 1.5);
  wearEdges(ctx, W, H, seed + 3, 1.0, 'rgba(60,45,25,');
  const t = tex(c);
  cache.set(key, t);
  return t;
}

const POSTERS = {
  measure: {
    bg: '#c9b28a', fg: '#1f1d1a', title: ['EVERY GRAM', 'IS COUNTED'], sub: 'Return all ballast to stock before leaving.',
    draw(ctx, W, H) {
      ctx.fillStyle = '#8e3526'; ctx.fillRect(0, 0, W, H * 0.52);
      ctx.strokeStyle = '#1f1d1a'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(W / 2, 70); ctx.lineTo(W / 2, 300); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(110, 120); ctx.lineTo(W - 110, 120); ctx.stroke();
      for (const x of [110, W - 110]) {
        ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x - 60, 230); ctx.moveTo(x, 120); ctx.lineTo(x + 60, 230); ctx.stroke();
        ctx.fillStyle = '#1f1d1a'; ctx.beginPath(); ctx.ellipse(x, 235, 70, 14, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillRect(W / 2 - 60, 300, 120, 18);
    },
  },
  debt: {
    bg: '#e3d8bd', fg: '#7d2a1f', title: ['DEBT', 'RISES'], sub: 'Weight below zero must be reported to the Senior Weigher.', size: 110,
    draw(ctx, W, H) {
      ctx.fillStyle = '#7d2a1f';
      for (let i = 0; i < 5; i++) { const y = 360 - i * 62; ctx.fillRect(170 + i * 8, y, 170 - i * 16, 46); }
      ctx.fillStyle = '#1f1d1a'; ctx.fillRect(60, 420, W - 120, 8);
    },
  },
  dam: {
    bg: '#3f5867', fg: '#e8e0cb', title: ['KALDEN', 'HOLDS'], sub: 'Power and water for the Republic since 1949.', size: 96,
    draw(ctx, W, H) {
      ctx.fillStyle = '#93a7ae'; ctx.fillRect(0, 300, W, 150);
      ctx.fillStyle = '#d9d2bf';
      ctx.beginPath(); ctx.moveTo(40, 120); ctx.lineTo(W - 40, 120); ctx.lineTo(W - 120, 420); ctx.lineTo(120, 420); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3f5867'; for (let i = 0; i < 6; i++) ctx.fillRect(110 + i * 55, 150, 22, 50);
    },
  },
  quiet: {
    bg: '#55705a', fg: '#efe7d2', title: ['QUIET.', 'WEIGHING', 'IN PROGRESS'], sub: 'Vibration alters the result.', size: 70,
    draw(ctx, W, H) {
      ctx.fillStyle = '#efe7d2'; ctx.beginPath(); ctx.arc(W / 2, 200, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#55705a'; ctx.beginPath(); ctx.arc(W / 2, 200, 96, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#efe7d2'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(W / 2, 200); ctx.lineTo(W / 2 + 60, 140); ctx.stroke();
    },
  },
  halde: {
    bg: '#d9cfb6', fg: '#2a2723', title: ['HALDE', '1949'], sub: 'A new lake for a new valley.', size: 104,
    draw(ctx, W, H) {
      ctx.fillStyle = '#6f8a93'; ctx.fillRect(0, 260, W, 200);
      ctx.fillStyle = '#2a2723';
      ctx.fillRect(220, 120, 40, 160); ctx.beginPath(); ctx.moveTo(210, 120); ctx.lineTo(240, 60); ctx.lineTo(270, 120); ctx.fill();
      for (const [x, ww, hh] of [[90, 90, 70], [300, 110, 60], [400, 70, 80]]) { ctx.fillRect(x, 280 - hh, ww, hh); ctx.beginPath(); ctx.moveTo(x - 10, 280 - hh); ctx.lineTo(x + ww / 2, 240 - hh); ctx.lineTo(x + ww + 10, 280 - hh); ctx.fill(); }
      ctx.fillStyle = 'rgba(111,138,147,0.85)'; ctx.fillRect(0, 230, W, 230);
    },
  },
};

// ---------------------------------------------------------------- small labels / tags
export function labelTexture(text, { w = 256, h = 96, bg = '#e8dfc6', fg = INK, font = FONTS.type, size = 30, sub = null, hole = true } = {}) {
  const key = 'label' + text + w + h + bg + fg + size + sub;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, hashString(text), 0.08);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${font}`;
  ctx.fillText(text, w / 2 + (hole ? 12 : 0), sub ? h * 0.38 : h / 2);
  if (sub) { ctx.font = `400 ${size * 0.7}px ${font}`; ctx.fillText(sub, w / 2 + (hole ? 12 : 0), h * 0.72); }
  if (hole) { ctx.fillStyle = '#3a3530'; ctx.beginPath(); ctx.arc(18, h / 2, 7, 0, Math.PI * 2); ctx.fill(); }
  wearEdges(ctx, w, h, hashString(text) + 1, 0.3);
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Name-tag atlas for the Hall of 312 (one cell per villager).
export function tagAtlas(entries, { cols = 16, cw = 192, ch = 64 } = {}) {
  const rows = Math.ceil(entries.length / cols);
  const c = canvas(cols * cw, rows * ch), ctx = c.getContext('2d');
  entries.forEach((e, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    ctx.fillStyle = '#e4dbc3'; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 20px ${FONTS.type}`; ctx.fillText(e.name, x + 22, y + ch * 0.36);
    ctx.font = `400 16px ${FONTS.type}`; ctx.fillText(`${e.kg} kg · Halde 1949`, x + 22, y + ch * 0.72);
    ctx.fillStyle = '#3a3530'; ctx.beginPath(); ctx.arc(x + 10, y + ch / 2, 4, 0, Math.PI * 2); ctx.fill();
  });
  speckle(ctx, c.width, c.height, 99, 0.06);
  const t = tex(c);
  return { texture: t, cols, rows };
}

// Split-flap display text (for lift cages and the Ledger Hall boards).
export function flapTexture(text, { w = 512, h = 96, cells = 12 } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#141312'; ctx.fillRect(0, 0, w, h);
  const cw = w / cells;
  const s = text.toUpperCase().padEnd(cells, ' ').slice(0, cells);
  for (let i = 0; i < cells; i++) {
    const x = i * cw;
    ctx.fillStyle = '#26241f'; ctx.fillRect(x + 3, 4, cw - 6, h - 8);
    ctx.fillStyle = '#0c0b0a'; ctx.fillRect(x + 3, h / 2 - 1, cw - 6, 2);
    ctx.fillStyle = '#e9e0c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${h * 0.62}px ${FONTS.sign}`;
    ctx.fillText(s[i], x + cw / 2, h / 2 + 3);
  }
  return tex(c);
}

export function clearSignCache() {
  for (const [k, v] of cache) { if (k !== 'drum' && v && v.dispose) v.dispose(); }
  for (const k of [...cache.keys()]) if (k !== 'drum') cache.delete(k);
}
