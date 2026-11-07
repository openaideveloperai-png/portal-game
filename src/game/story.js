// Dialogue and scripted sequences. Lines are queued; each channel has its own sound
// dressing (PA chime, intercom click + static, reel-to-reel hiss, or nothing in person).
import { audio } from '../core/audio.js';

export const SPEAKERS = {
  varga: { name: 'Dr. O. Varga', cls: 'varga', pitch: 182, channel: 'pa' },
  brask: { name: 'T. Brask', cls: 'brask', pitch: 104, channel: 'intercom' },
  pa: { name: 'Announcement', cls: 'pa', pitch: 160, channel: 'pa' },
  reel: { name: 'Orientation reel · 1951', cls: 'reel', pitch: 205, channel: 'reel' },
  lind: { name: 'E. Lind', cls: 'you', pitch: 140, channel: 'person' },
};

export class Story {
  constructor(game) {
    this.game = game;
    this.queue = Promise.resolve();
    this.token = 0;
    this.waits = [];
    this.time = 0;
    this.flags = {};
    this.speaking = false;
  }

  // game-time clock (stops while paused)
  tick(dt) {
    this.time += dt;
    const due = this.waits.filter(w => w.at <= this.time);
    this.waits = this.waits.filter(w => w.at > this.time);
    for (const w of due) w.res();
  }
  wait(sec) {
    const tok = this.token;
    return new Promise((res, rej) => this.waits.push({ at: this.time + sec, res: () => (tok === this.token ? res() : rej(new Cancelled())) }));
  }
  until(fn, poll = 0.1) {
    const tok = this.token;
    return new Promise((res, rej) => {
      const check = () => {
        if (tok !== this.token) return rej(new Cancelled());
        if (fn()) return res();
        this.waits.push({ at: this.time + poll, res: check });
      };
      check();
    });
  }

  // Cancel everything belonging to the current level (on unload / restart).
  cancelAll() {
    this.token++;
    const ws = this.waits; this.waits = [];
    for (const w of ws) w.res();
    this.queue = Promise.resolve();
    this.speaking = false;
    this.staticLoop?.stop(0.1); this.staticLoop = null;
    this.game.ui.clearSubtitles();
  }

  run(fn) {
    const tok = this.token;
    const p = (async () => { try { await fn(this); } catch (e) { if (!(e instanceof Cancelled)) console.error(e); } })();
    void tok;
    return p;
  }

  // say(speaker, text, opts) — queued. Resolves when the line has finished.
  say(who, text, opts = {}) {
    const tok = this.token;
    const next = this.queue.then(() => (tok === this.token ? this.speak(who, text, opts) : null)).catch(() => {});
    this.queue = next;
    return next;
  }

  async speak(who, text, { channel = null, pos = null, hold = 0, chime = null } = {}) {
    const sp = SPEAKERS[who] || { name: who, cls: 'pa', pitch: 150, channel: 'person' };
    const ch = channel || sp.channel;
    const words = text.split(/\s+/).length;
    const dur = Math.max(2.4, words * 0.34 + 1.1) + hold;
    this.speaking = true;
    if (ch === 'pa' && chime !== false && !this._chimedRecently) {
      audio.play('chime', { notes: who === 'pa' ? [784, 659, 523] : [659, 523] });
      this._chimedRecently = true;
      setTimeout(() => { this._chimedRecently = false; }, 9000);
      await this.wait(who === 'pa' ? 1.2 : 0.9);
    }
    if (ch === 'intercom') { audio.play('click'); this.staticLoop = audio.loop('static', { gain: 0.18, bus: 'voice' }); await this.wait(0.25); }
    if (ch === 'reel') { this.staticLoop = audio.loop('hiss', { gain: 0.35, bus: 'voice' }); await this.wait(0.3); }
    const vol = this.game.settings.voice ?? 0.6;
    audio.murmur(text, { pitch: sp.pitch, channel: ch, gain: vol > 0 ? 1 : 0, rate: 1 });
    this.game.ui.subtitle(sp.name, sp.cls, text, dur);
    await this.wait(dur);
    if (this.staticLoop) { this.staticLoop.stop(0.2); this.staticLoop = null; if (ch === 'intercom') audio.play('click', { gain: 0.6 }); }
    this.speaking = false;
  }

  flag(k, v = true) { this.flags[k] = v; }
}

export class Cancelled extends Error {}
