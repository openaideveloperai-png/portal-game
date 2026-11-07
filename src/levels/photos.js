// Period photographs. The game registers a studio that renders them from 3D scenes
// (see game/photostudio.js); if that fails, a plain painted stand-in is used.
const cache = new Map();
let studio = null;
export function setPhotoStudio(fn) { studio = fn; }
export function prerenderPhotos(kinds = ['opening', 'halde', 'agnes']) { for (const k of kinds) photoDataURL(k); }
export function photoDataURL(kind) {
  if (cache.has(kind)) return cache.get(kind);
  if (studio) {
    try {
      const url = studio(kind);
      if (url) { cache.set(kind, url); return url; }
    } catch (e) { console.warn('photo studio', kind, e); }
  }
  const W = 520, H = 380;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#bfb19a'); g.addColorStop(0.55, '#9e8f78'); g.addColorStop(1, '#6f6352');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#5a4f42';
  if (kind === 'opening') {
    x.fillRect(0, 120, W, 140);
    x.fillStyle = '#3b342c';
    for (let i = 0; i < 6; i++) {
      const px = 70 + i * 75, h = 150 + (i % 2) * 12;
      x.beginPath(); x.ellipse(px, 360 - h - 18, 15, 19, 0, 0, Math.PI * 2); x.fill();
      x.fillRect(px - 26, 360 - h, 52, h);
    }
    x.fillStyle = '#d8ccb4'; x.fillRect(140, 220, 18, 120);
  } else {
    x.fillRect(0, 200, W, 180);
  }
  const id = x.getImageData(0, 0, W, H); const d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,20,10,0.55)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  const url = c.toDataURL('image/jpeg', 0.85);
  cache.set(kind, url);
  return url;
}
