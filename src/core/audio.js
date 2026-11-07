// Procedural audio. Nothing here is a sample: footsteps, the instrument's ring, thuds,
// rain, the PA chime and the church bell are all synthesised with WebAudio nodes or
// small generated buffers. Buses: sfx, amb, music, voice -> master -> compressor.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.volumes = { master: 0.8, sfx: 0.9, amb: 0.8, music: 0.7, voice: 0.6 };
    this.loops = new Set();
    this.reverbPreset = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = this.ctx = new Ctx({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.master.connect(this.comp).connect(ctx.destination);
    this.bus = {};
    for (const b of ['sfx', 'amb', 'music', 'voice']) { this.bus[b] = ctx.createGain(); this.bus[b].connect(this.master); }
    this.reverb = ctx.createConvolver();
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 1; this.reverbSend.connect(this.reverb);
    this.noise = this.makeNoise('white', 3);
    this.pink = this.makeNoise('pink', 4);
    this.brown = this.makeNoise('brown', 5);
    this.applyVolumes();
    this.setReverb('room');
    this.ready = true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    for (const b of ['sfx', 'amb', 'music', 'voice']) this.bus[b].gain.setTargetAtTime(this.volumes[b], t, 0.05);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  makeNoise(kind, seconds) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }

  // Generated impulse responses for each kind of space.
  setReverb(preset) {
    if (!this.ctx || this.reverbPreset === preset) return;
    this.reverbPreset = preset;
    const P = {
      booth: [0.35, 0.002, 0.25, 9000],
      small: [0.7, 0.004, 0.3, 7000],
      room: [1.3, 0.008, 0.33, 6000],
      hall: [2.6, 0.015, 0.38, 4500],
      vast: [5.5, 0.03, 0.45, 3000],
      outdoor: [1.6, 0.02, 0.18, 5000],
    }[preset] || [1.3, 0.008, 0.33, 6000];
    const [decay, pre, wet, damp] = P;
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * (decay + pre + 0.1));
    const buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        if (t < pre) { d[i] = 0; continue; }
        const tt = t - pre;
        const env = Math.exp(-tt * 6.9 / decay);
        const cutoff = damp * Math.exp(-tt * 1.8 / decay) + 400;
        const a = Math.min(1, 2 * Math.PI * cutoff / sr);
        lp += a * ((Math.random() * 2 - 1) - lp);
        let v = lp * env;
        // a handful of early reflections
        if (tt < 0.08 && Math.random() < 0.004) v += (Math.random() - 0.5) * 2 * (1 - tt / 0.08);
        d[i] = v;
      }
    }
    this.reverb.buffer = buf;
    this.reverbGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.2);
  }

  setListener(pos, fwd, up) {
    if (!this.ctx) return;
    const l = this.ctx.listener, t = this.ctx.currentTime;
    this.listenerPos = pos;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02); l.upY.setTargetAtTime(up.y, t, 0.02); l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  // Output chain for a one-shot: optional 3D panner, bus, reverb send.
  out(bus = 'sfx', pos = null, send = 0.3, ref = 2) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let head = g;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 200;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p); head = p; g._panner = p;
    }
    head.connect(this.bus[bus]);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; head.connect(s); s.connect(this.reverbSend); }
    return g;
  }

  env(gainNode, t, a, peak, d, sustain = 0) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  }

  noiseBurst(dest, t, { dur = 0.08, f = 2000, q = 1, type = 'bandpass', gain = 0.5, attack = 0.002, buffer = null, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buffer || this.noise; src.playbackRate.value = rate;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain();
    src.connect(flt).connect(g).connect(dest);
    this.env(g, t, attack, gain, dur);
    const off = Math.random() * 2;
    src.start(t, off); src.stop(t + attack + dur + 0.05);
    return { src, flt, g };
  }

  tone(dest, t, { f = 440, type = 'sine', dur = 0.3, gain = 0.3, attack = 0.005, f1 = null, glide = 0.1, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + glide);
    const g = ctx.createGain();
    o.connect(g).connect(dest);
    this.env(g, t, attack, gain, dur);
    o.start(t); o.stop(t + attack + dur + 0.05);
    return { o, g };
  }

  // ---------------------------------------------------------------- one-shots
  play(name, opts = {}) {
    if (!this.ready) return;
    const fn = this['s_' + name];
    if (fn) { try { fn.call(this, opts); } catch (e) { console.warn('sound', name, e); } }
  }

  s_footstep({ surface = 'stone', pos = null, gain = 1, heavy = 1 }) {
    const t = this.now + 0.005, o = this.out('sfx', pos, 0.25, 1);
    const v = (0.85 + Math.random() * 0.3) * gain;
    const p = 0.9 + Math.random() * 0.2;
    o.gain.value = 0.55 * v;
    if (surface === 'metal') {
      this.noiseBurst(o, t, { dur: 0.05, f: 3200 * p, q: 0.8, gain: 0.35 });
      for (const f of [480, 910, 1630]) this.tone(o, t, { f: f * p, dur: 0.22, gain: 0.045, type: 'triangle' });
      this.tone(o, t, { f: 80, dur: 0.08, gain: 0.25 * heavy });
    } else if (surface === 'wood') {
      this.noiseBurst(o, t, { dur: 0.045, f: 900 * p, q: 1.2, gain: 0.4 });
      this.tone(o, t, { f: 150 * p, f1: 90, dur: 0.1, gain: 0.3 * heavy });
    } else if (surface === 'water' || surface === 'mud') {
      this.noiseBurst(o, t, { dur: 0.16, f: 700 * p, q: 0.6, type: 'lowpass', gain: 0.5, attack: 0.01 });
      this.noiseBurst(o, t + 0.04, { dur: 0.1, f: 2400 * p, q: 3, gain: 0.12 });
    } else if (surface === 'rubber') {
      this.noiseBurst(o, t, { dur: 0.04, f: 600 * p, q: 0.8, gain: 0.3 });
      this.tone(o, t, { f: 95, dur: 0.07, gain: 0.25 * heavy });
    } else {
      // hard stone floors: heel then toe
      this.noiseBurst(o, t, { dur: 0.035, f: 2600 * p, q: 0.9, gain: 0.38 });
      this.noiseBurst(o, t + 0.035, { dur: 0.05, f: 1700 * p, q: 0.7, gain: 0.22 });
      this.tone(o, t, { f: 110 * p, f1: 70, dur: 0.07, gain: 0.22 * heavy });
    }
  }

  s_land({ surface = 'stone', gain = 1, heavy = 1 }) {
    this.s_footstep({ surface, gain: gain * 1.3, heavy: heavy * 1.6 });
    const t = this.now, o = this.out('sfx', null, 0.2);
    this.noiseBurst(o, t, { dur: 0.08, f: 400, type: 'lowpass', gain: 0.25 * gain });
  }

  s_cloth({ gain = 0.5 } = {}) {
    const t = this.now, o = this.out('sfx', null, 0.05);
    this.noiseBurst(o, t, { dur: 0.12, f: 2500, q: 0.5, gain: 0.08 * gain, attack: 0.03, buffer: this.pink });
  }

  // The instrument: a tuning-fork ring that bends down (draw) or up (give).
  s_tare({ give = false, amount = 1, stored = 0 }) {
    const t = this.now, o = this.out('sfx', null, 0.45);
    const base = 392 * Math.pow(2, -stored / 12 * 2);
    const [f0, f1] = give ? [base * 0.75, base * 1.12] : [base * 1.12, base * 0.75];
    for (const [d, g] of [[0, 0.16], [4, 0.1], [-3, 0.07]]) {
      const { o: osc } = this.tone(o, t, { f: f0, f1, glide: 0.32, dur: 1.4, gain: g, attack: 0.012, detune: d });
      osc.type = 'sine';
    }
    this.tone(o, t, { f: f0 * 2.76, f1: f1 * 2.76, glide: 0.32, dur: 0.5, gain: 0.03 });
    this.tone(o, t + (give ? 0.28 : 0), { f: give ? 60 : 85, f1: give ? 38 : 50, glide: 0.25, dur: 0.35, gain: 0.35 });
    this.noiseBurst(o, t, { dur: 0.25, f: 5000, q: 0.4, gain: 0.03, attack: 0.05 });
    this.s_tick({ when: 0.3 });
  }

  s_tareFail() {
    const t = this.now, o = this.out('sfx', null, 0.2);
    this.noiseBurst(o, t, { dur: 0.06, f: 500, type: 'lowpass', gain: 0.4 });
    this.tone(o, t, { f: 120, type: 'square', dur: 0.08, gain: 0.05 });
    this.tone(o, t + 0.07, { f: 104, type: 'square', dur: 0.1, gain: 0.04 });
  }

  s_tick({ when = 0, gain = 1, pos = null } = {}) {
    const t = this.now + when, o = this.out('sfx', pos, 0.1, 1);
    this.noiseBurst(o, t, { dur: 0.012, f: 4200, q: 2, gain: 0.25 * gain });
    this.tone(o, t, { f: 2100, dur: 0.02, gain: 0.04 * gain, type: 'square' });
  }

  s_impact({ intensity = 1, weight = 2, pos = null, material = 'wood' }) {
    const t = this.now, o = this.out('sfx', pos, 0.3, 2.5);
    const v = clamp(intensity, 0.05, 1.5);
    const w = clamp(weight, -2, 8);
    const f = 140 / (1 + Math.max(0, w) * 0.22);
    o.gain.value = 0.8;
    this.tone(o, t, { f: f * 1.4, f1: f * 0.6, glide: 0.12, dur: 0.18 + Math.max(0, w) * 0.04, gain: 0.5 * v });
    this.noiseBurst(o, t, { dur: 0.06 + Math.max(0, w) * 0.01, f: material === 'metal' ? 1800 : 520, q: material === 'metal' ? 4 : 1.2, gain: 0.45 * v });
    if (material === 'metal') for (const ff of [640, 1220, 2100]) this.tone(o, t, { f: ff * (0.9 + Math.random() * 0.2), dur: 0.35, gain: 0.04 * v, type: 'triangle' });
    else this.noiseBurst(o, t + 0.01, { dur: 0.08, f: 260, q: 6, gain: 0.25 * v });
  }

  s_clank({ pos = null, gain = 1 } = {}) {
    const t = this.now, o = this.out('sfx', pos, 0.4, 3);
    o.gain.value = gain;
    this.noiseBurst(o, t, { dur: 0.08, f: 900, q: 2, gain: 0.5 });
    for (const f of [220, 347, 590, 910]) this.tone(o, t, { f, dur: 0.5, gain: 0.05, type: 'triangle' });
    this.tone(o, t, { f: 70, f1: 45, glide: 0.2, dur: 0.3, gain: 0.4 });
  }

  s_plate({ down = true, pos = null }) {
    const t = this.now, o = this.out('sfx', pos, 0.25, 2);
    this.noiseBurst(o, t, { dur: 0.05, f: down ? 700 : 1100, q: 2, gain: 0.45 });
    this.tone(o, t, { f: down ? 95 : 130, f1: down ? 60 : 90, glide: 0.08, dur: 0.12, gain: 0.35 });
    this.s_tick({ when: 0.06, pos });
  }

  s_relay({ pos = null } = {}) {
    const t = this.now, o = this.out('sfx', pos, 0.2, 2);
    this.noiseBurst(o, t, { dur: 0.02, f: 3000, q: 3, gain: 0.35 });
    this.noiseBurst(o, t + 0.03, { dur: 0.02, f: 2500, q: 3, gain: 0.25 });
  }

  s_chime({ pos = null, notes = [784, 659, 523], gain = 1 } = {}) {
    const t = this.now, o = this.out('voice', pos, 0.7, 6);
    o.gain.value = gain;
    notes.forEach((f, i) => {
      const tt = t + i * 0.42;
      this.tone(o, tt, { f, dur: 1.6, gain: 0.16, attack: 0.004 });
      this.tone(o, tt, { f: f * 4.0, dur: 0.25, gain: 0.03 });
      this.tone(o, tt, { f: f * 2.0, dur: 0.6, gain: 0.04 });
    });
  }

  s_click({ gain = 1 } = {}) {
    const t = this.now, o = this.out('voice', null, 0.05);
    this.noiseBurst(o, t, { dur: 0.015, f: 3000, q: 1, gain: 0.3 * gain });
    this.noiseBurst(o, t + 0.01, { dur: 0.12, f: 3000, q: 0.5, gain: 0.04 * gain });
  }

  s_typekey({ gain = 1 } = {}) {
    const t = this.now, o = this.out('sfx', null, 0.05);
    this.noiseBurst(o, t, { dur: 0.018, f: 3500 + Math.random() * 1500, q: 2, gain: 0.12 * gain });
    this.tone(o, t, { f: 180, dur: 0.03, gain: 0.05 * gain });
  }

  s_stamp() {
    const t = this.now, o = this.out('sfx', null, 0.15);
    this.tone(o, t, { f: 90, f1: 50, glide: 0.08, dur: 0.15, gain: 0.5 });
    this.noiseBurst(o, t, { dur: 0.05, f: 1500, q: 0.5, gain: 0.25 });
  }

  s_paper() {
    const t = this.now, o = this.out('sfx', null, 0.05);
    for (let i = 0; i < 4; i++) this.noiseBurst(o, t + i * 0.035 + Math.random() * 0.02, { dur: 0.05, f: 3000 + Math.random() * 3000, q: 0.7, gain: 0.07, buffer: this.pink });
  }

  s_glassCrack({ pos = null }) {
    const t = this.now, o = this.out('sfx', pos, 0.3, 2);
    for (let i = 0; i < 6; i++) this.noiseBurst(o, t + i * 0.02 * Math.random(), { dur: 0.015, f: 5000 + Math.random() * 3000, q: 4, gain: 0.3 });
    this.tone(o, t, { f: 3100, dur: 0.12, gain: 0.03 });
  }

  s_glassBreak({ pos = null }) {
    const t = this.now, o = this.out('sfx', pos, 0.45, 3);
    this.noiseBurst(o, t, { dur: 0.3, f: 4000, q: 0.6, gain: 0.5 });
    for (let i = 0; i < 40; i++) {
      const tt = t + Math.pow(Math.random(), 1.8) * 0.9;
      this.tone(o, tt, { f: 2500 + Math.random() * 5000, dur: 0.08 + Math.random() * 0.15, gain: 0.03 + Math.random() * 0.03 });
    }
  }

  s_splash({ pos = null, gain = 1 }) {
    const t = this.now, o = this.out('sfx', pos, 0.3, 2);
    o.gain.value = gain;
    this.noiseBurst(o, t, { dur: 0.4, f: 1200, type: 'lowpass', q: 0.5, gain: 0.5, attack: 0.01 });
    for (let i = 0; i < 6; i++) { const tt = t + 0.05 + Math.random() * 0.4; this.tone(o, tt, { f: 500 + Math.random() * 900, f1: 1400 + Math.random() * 800, glide: 0.04, dur: 0.05, gain: 0.05 }); }
  }

  s_thunder() {
    const t = this.now, o = this.out('amb', null, 0.6);
    this.noiseBurst(o, t, { dur: 3.5, f: 160, type: 'lowpass', q: 0.4, gain: 0.7, attack: 0.08, buffer: this.brown });
    this.noiseBurst(o, t + 0.05, { dur: 0.6, f: 900, type: 'lowpass', q: 0.4, gain: 0.3, attack: 0.01 });
  }

  s_groan({ gain = 1 } = {}) {
    const ctx = this.ctx, t = this.now, o = this.out('amb', null, 0.8);
    o.gain.value = gain;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(38, t); osc.frequency.linearRampToValueAtTime(31, t + 3.5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 1.5;
    lfo.connect(lg).connect(osc.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 3;
    const g = ctx.createGain();
    osc.connect(f).connect(g).connect(o);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    osc.start(t); lfo.start(t); osc.stop(t + 4.3); lfo.stop(t + 4.3);
    for (let i = 0; i < 5; i++) this.noiseBurst(o, t + 0.6 + Math.random() * 3, { dur: 0.3, f: 300 + Math.random() * 400, q: 12, gain: 0.25 });
  }

  // Church bell: inharmonic partials (hum, prime, tierce, quint, nominal...).
  s_bell({ f = 196, gain = 1, pos = null } = {}) {
    const t = this.now, o = this.out('music', pos, 0.9, 20);
    o.gain.value = gain;
    const parts = [[0.5, 0.5, 9], [1, 0.35, 7], [1.183, 0.28, 5], [1.506, 0.16, 4], [2.0, 0.22, 3.5], [2.514, 0.1, 2.5], [2.662, 0.08, 2], [3.011, 0.06, 1.6], [4.166, 0.04, 1.2]];
    for (const [r, g, d] of parts) this.tone(o, t, { f: f * r, dur: d, gain: g * 0.22, attack: 0.002, detune: (Math.random() - 0.5) * 6 });
    this.noiseBurst(o, t, { dur: 0.05, f: 2200, q: 1, gain: 0.15 });
  }

  // Music box tine.
  s_tine({ f = 880, gain = 1, when = 0 } = {}) {
    const t = this.now + when, o = this.out('music', null, 0.6);
    o.gain.value = gain;
    this.tone(o, t, { f, dur: 2.2, gain: 0.12, attack: 0.002 });
    this.tone(o, t, { f: f * 4.07, dur: 0.18, gain: 0.025 });
    this.tone(o, t, { f: f * 2.01, dur: 0.6, gain: 0.02 });
  }

  // Soft felt-piano-ish note for score moments.
  s_piano({ f = 220, gain = 1, when = 0, dur = 3 } = {}) {
    const t = this.now + when, o = this.out('music', null, 0.7);
    o.gain.value = gain;
    this.tone(o, t, { f, dur, gain: 0.14, attack: 0.008, type: 'triangle' });
    this.tone(o, t, { f: f * 2, dur: dur * 0.5, gain: 0.04, attack: 0.008 });
    this.tone(o, t, { f: f * 3.01, dur: dur * 0.25, gain: 0.015, attack: 0.008 });
    this.noiseBurst(o, t, { dur: 0.02, f: 1500, q: 1, gain: 0.03 });
  }

  s_flap({ count = 6 } = {}) {
    const t = this.now, o = this.out('sfx', null, 0.15);
    for (let i = 0; i < count; i++) this.noiseBurst(o, t + i * 0.045, { dur: 0.012, f: 2800 + Math.random() * 800, q: 3, gain: 0.25 });
  }

  s_ui({ kind = 'move' } = {}) {
    if (kind === 'move') this.s_typekey({ gain: 0.6 });
    else if (kind === 'select') { this.s_typekey({ gain: 1 }); this.s_tick({ when: 0.05, gain: 0.6 }); }
    else if (kind === 'back') this.s_paper();
  }

  // ---------------------------------------------------------------- loops
  // A loop is a small graph with a gain we can fade and an optional panner.
  loop(kind, { pos = null, gain = 1, bus = null, send = 0.3, ref = 3 } = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const out = this.out(bus || (kind === 'room' || kind === 'rain' || kind === 'wind' || kind === 'water' || kind === 'drone' ? 'amb' : 'sfx'), pos, send, ref);
    out.gain.value = 0;
    const nodes = [];
    const src = (buffer, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.playbackRate.value = rate; s.start(this.now, Math.random() * 2); nodes.push(s); return s; };
    const flt = (type, f, q = 0.7) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); nodes.push(o); return o; };
    const g = v => { const x = ctx.createGain(); x.gain.value = v; return x; };
    let handle = { out, nodes, kind, base: gain };
    switch (kind) {
      case 'room': {
        src(this.brown).connect(flt('lowpass', 170)).connect(g(0.5)).connect(out);
        for (const [f, a] of [[50, 0.02], [100, 0.012], [150, 0.006], [250, 0.003]]) osc('sine', f).connect(g(a)).connect(out);
        break;
      }
      case 'machine': {
        src(this.brown).connect(flt('lowpass', 260, 2)).connect(g(0.6)).connect(out);
        const o = osc('sawtooth', 46); const lf = flt('lowpass', 180, 4); o.connect(lf).connect(g(0.12)).connect(out);
        const l = osc('sine', 3.2); const lg = g(0.05); l.connect(lg).connect(out.gain);
        break;
      }
      case 'motor': {
        const o = osc('sawtooth', 58); o.connect(flt('lowpass', 420, 3)).connect(g(0.18)).connect(out);
        src(this.noise).connect(flt('bandpass', 900, 0.7)).connect(g(0.08)).connect(out);
        handle.osc = o;
        break;
      }
      case 'chain': {
        const n = src(this.noise); const bp = flt('bandpass', 2400, 6); const am = g(0);
        n.connect(bp).connect(am).connect(out);
        const l = osc('square', 13); const lg = g(0.25); l.connect(lg).connect(am.gain);
        src(this.brown).connect(flt('lowpass', 200)).connect(g(0.3)).connect(out);
        break;
      }
      case 'vent': {
        src(this.pink).connect(flt('bandpass', 700, 0.5)).connect(g(0.6)).connect(out);
        const b = src(this.noise); const f = flt('bandpass', 1800, 1.2); b.connect(f).connect(g(0.1)).connect(out);
        const l = osc('sine', 0.4); const lg = g(300); l.connect(lg).connect(f.frequency);
        break;
      }
      case 'rain': {
        src(this.pink).connect(flt('highpass', 600)).connect(flt('lowpass', 7000)).connect(g(0.35)).connect(out);
        src(this.noise, 0.5).connect(flt('bandpass', 3500, 0.4)).connect(g(0.12)).connect(out);
        src(this.brown).connect(flt('lowpass', 300)).connect(g(0.25)).connect(out);
        break;
      }
      case 'wind': {
        const n = src(this.pink); const f = flt('bandpass', 420, 1.5); n.connect(f).connect(g(0.8)).connect(out);
        const l = osc('sine', 0.09); const lg = g(220); l.connect(lg).connect(f.frequency);
        const l2 = osc('sine', 0.23); const lg2 = g(0.25); l2.connect(lg2).connect(out.gain);
        break;
      }
      case 'water': {
        src(this.pink).connect(flt('lowpass', 900, 0.4)).connect(g(0.45)).connect(out);
        src(this.noise).connect(flt('bandpass', 2200, 2)).connect(g(0.05)).connect(out);
        break;
      }
      case 'drone': {
        for (const [f, a] of [[55, 0.06], [82.4, 0.04], [110.3, 0.025], [164.8, 0.012]]) { const o = osc('triangle', f); const l = flt('lowpass', 500); o.connect(l).connect(g(a)).connect(out); }
        break;
      }
      case 'static': {
        src(this.noise).connect(flt('bandpass', 3000, 0.8)).connect(g(0.12)).connect(out);
        break;
      }
      case 'hiss': {
        src(this.pink).connect(flt('highpass', 2500)).connect(g(0.2)).connect(out);
        const o = osc('sine', 60); o.connect(g(0.02)).connect(out);
        break;
      }
      case 'hum': {
        const o = osc('sine', 110); const o2 = osc('sine', 110.6);
        o.connect(g(0.05)).connect(out); o2.connect(g(0.05)).connect(out);
        handle.osc = o; handle.osc2 = o2;
        break;
      }
      default: break;
    }
    out.gain.setTargetAtTime(gain, this.now, 0.4);
    handle.set = (v, tc = 0.3) => out.gain.setTargetAtTime(v, this.now, tc);
    handle.setPos = p => {
      const pn = out._panner; if (!pn) return;
      const t = this.now;
      if (pn.positionX) { pn.positionX.setTargetAtTime(p.x, t, 0.05); pn.positionY.setTargetAtTime(p.y, t, 0.05); pn.positionZ.setTargetAtTime(p.z, t, 0.05); }
      else pn.setPosition(p.x, p.y, p.z);
    };
    handle.stop = (fade = 0.4) => {
      out.gain.setTargetAtTime(0, this.now, fade / 3);
      setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* ignore */ } } try { out.disconnect(); } catch (e) { /* ignore */ } }, fade * 1000 + 200);
      this.loops.delete(handle);
    };
    this.loops.add(handle);
    return handle;
  }

  stopAllLoops(fade = 0.5) { for (const l of [...this.loops]) l.stop(fade); }

  // ---------------------------------------------------------------- ambience scheduler
  // Random drips/creaks/distant knocks while a level runs.
  ambientTick(dt, profile) {
    if (!this.ready || !profile) return;
    this._ambT = (this._ambT || 0) - dt;
    if (this._ambT > 0) return;
    this._ambT = (profile.every || 3) * (0.5 + Math.random());
    const r = Math.random();
    const lp = this.listenerPos;
    const around = () => ({ x: lp.x + (Math.random() - 0.5) * 16, y: lp.y + Math.random() * 3, z: lp.z + (Math.random() - 0.5) * 16 });
    if (profile.drips && r < 0.5) {
      const t = this.now, o = this.out('amb', around(), 0.8, 2);
      const f = 1400 + Math.random() * 1600;
      this.tone(o, t, { f, f1: f * 0.55, glide: 0.03, dur: 0.12, gain: 0.08 * profile.drips });
    } else if (profile.creaks && r < 0.75) {
      const t = this.now, o = this.out('amb', around(), 0.6, 3);
      this.noiseBurst(o, t, { dur: 0.5 + Math.random(), f: 250 + Math.random() * 500, q: 14, gain: 0.08 * profile.creaks, attack: 0.15 });
    } else if (profile.knocks) {
      const t = this.now, o = this.out('amb', around(), 0.9, 4);
      this.tone(o, t, { f: 70, f1: 45, glide: 0.1, dur: 0.4, gain: 0.15 * profile.knocks });
      this.noiseBurst(o, t, { dur: 0.08, f: 500, type: 'lowpass', gain: 0.1 * profile.knocks });
    }
  }

  // ---------------------------------------------------------------- voice murmur
  // A filtered, wordless "speech shape" played under subtitles so voices have presence
  // without pretending to be recorded dialogue.
  murmur(text, { pitch = 120, channel = 'intercom', gain = 1, rate = 1 } = {}) {
    if (!this.ready || gain <= 0) return 0;
    const ctx = this.ctx, t0 = this.now + 0.05;
    const out = this.out('voice', null, channel === 'pa' ? 0.8 : 0.25);
    out.gain.value = 0.5 * gain;
    let chain = out;
    if (channel !== 'person') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = channel === 'pa' ? 400 : 320;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = channel === 'reel' ? 3800 : 3000;
      const ws = ctx.createWaveShaper(); const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
      ws.curve = curve;
      hp.connect(lp).connect(ws).connect(out);
      chain = hp;
    }
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
    const amp = ctx.createGain(); amp.gain.value = 0;
    const g1 = ctx.createGain(); g1.gain.value = 0.9; const g2 = ctx.createGain(); g2.gain.value = 0.55;
    src.connect(f1).connect(g1).connect(amp); src.connect(f2).connect(g2).connect(amp);
    const breath = ctx.createBufferSource(); breath.buffer = this.pink; breath.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2500; bf.Q.value = 1;
    const bg = ctx.createGain(); bg.gain.value = 0.0;
    breath.connect(bf).connect(bg).connect(chain);
    amp.connect(chain);
    const vowels = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [440, 1020], [660, 1720], [300, 870], [490, 1350]];
    let t = t0;
    const words = text.replace(/[^\w\s',.?!-]/g, '').split(/\s+/).filter(Boolean);
    const syl = w => Math.max(1, (w.match(/[aeiouy]+/gi) || []).length);
    src.frequency.setValueAtTime(pitch, t);
    for (let wi = 0; wi < words.length; wi++) {
      const w = words[wi];
      const n = Math.min(4, syl(w));
      for (let s = 0; s < n; s++) {
        const d = (0.11 + Math.random() * 0.07) / rate;
        const v = vowels[Math.floor(Math.random() * vowels.length)];
        f1.frequency.setTargetAtTime(v[0], t, 0.02); f2.frequency.setTargetAtTime(v[1], t, 0.02);
        const p = pitch * (1 + (Math.random() - 0.5) * 0.12 - (wi / words.length) * 0.08);
        src.frequency.setTargetAtTime(p, t, 0.04);
        amp.gain.setTargetAtTime(0.5 + Math.random() * 0.3, t, 0.015);
        amp.gain.setTargetAtTime(0.08, t + d * 0.75, 0.02);
        if (Math.random() < 0.3) { bg.gain.setTargetAtTime(0.05, t + d * 0.7, 0.01); bg.gain.setTargetAtTime(0, t + d, 0.01); }
        t += d;
      }
      const punct = /[.?!]$/.test(w) ? 0.32 : /,$/.test(w) ? 0.16 : 0.035;
      amp.gain.setTargetAtTime(0, t, 0.02);
      t += punct / rate;
    }
    src.start(t0); src.stop(t + 0.3); breath.start(t0); breath.stop(t + 0.3);
    setTimeout(() => { try { out.disconnect(); } catch (e) { /* ignore */ } }, (t - t0 + 1) * 1000);
    return t - t0;
  }
}

export const audio = new Audio();
