// Progress + settings in localStorage. Every access is guarded: private windows and
// blocked storage must never break the game.
const KEY = 'tare.save.v1';
const SKEY = 'tare.settings.v1';

export const DEFAULT_SETTINGS = {
  quality: 'medium', fov: 74, sensitivity: 1, invertY: false, headBob: true,
  master: 0.8, music: 0.7, voice: 0.6, sfx: 0.9, subSize: 18,
};

function read(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

export class Save {
  constructor() {
    this.data = Object.assign({ level: 0, furthest: 0, read: {}, docs: {}, started: false, finished: false }, read(KEY) || {});
  }
  get hasProgress() { return this.data.started && this.data.level > 0; }
  setLevel(i) { this.data.level = i; this.data.furthest = Math.max(this.data.furthest, i); this.data.started = true; this.flush(); }
  hasRead(id) { return !!this.data.read[id]; }
  markRead(id, doc) { this.data.read[id] = true; this.data.docs[id] = doc; this.flush(); }
  documents() { return Object.values(this.data.docs || {}); }
  finish() { this.data.finished = true; this.flush(); }
  reset() { this.data = { level: 0, furthest: this.data.furthest, read: this.data.read, docs: this.data.docs, started: true, finished: this.data.finished }; this.flush(); }
  flush() { write(KEY, this.data); }
}

export function loadSettings() {
  const s = Object.assign({}, DEFAULT_SETTINGS, read(SKEY) || {});
  if (!read(SKEY)) {
    // pick a sensible default for the machine
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 4;
    s.quality = mem >= 8 && cores >= 8 ? 'high' : mem <= 4 ? 'low' : 'medium';
  }
  return s;
}
export function saveSettings(s) { write(SKEY, s); }
