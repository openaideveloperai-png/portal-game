// EPILOGUE — Morning on the crest. The village is back under the water.
import * as THREE from 'three';
import { buildExterior } from '../render/sky.js';
import { audio } from '../core/audio.js';
import { DOCS } from './docs.js';

const PI = Math.PI;
const VARGA = { name: 'Varga', body: 'f', skin: 'light', outfit: 'varga', hair: 'parted', hairColor: '#bdb8ae', grey: 0.95, glasses: true, posture: 0.06, age: 1 };
const BRASK = { name: 'Brask', body: 'm', skin: 'light', outfit: 'brask', hair: 'parted', beard: true, hairColor: '#aaa49a', grey: 0.85, belly: 0.05, posture: 0.08, age: 1 };

export default {
  id: 'finale', ledger: 'III', chamber: 0, title: 'Balanced',
  tare: { capacity: 4, debt: true },
  build(L) {
    L.killY = -12;
    L.wet = 0.5;
    L.fog('#8f8c86', 0.006);
    L.env(0.8);
    L.reverb = 'outdoor';
    L.ambience = { room: 0, wind: 0.25, water: 0.15, every: 8 };
    L.hemi('#b9c3cb', '#5b5248', 0.9);
    L.sun({ dir: [-0.85, -0.22, -0.3], color: '#ffd2a1', intensity: 2.2, area: 40, at: [-10, 0, 0] });
    const P = L.props;
    L.solid([-64, -1, -4], [26, 0, 4], 'slab_ext', { surface: 'stone', grime: false });
    L.solid([-64, 0, -4.5], [26, 1.05, -4.0], 'concrete_ext', { surface: 'stone' });
    L.solid([-64, 1.05, -4.6], [26, 1.15, -3.9], 'concrete_ext', { bevel: 0.02 });
    L.solid([-64, 0, 4.0], [26, 0.22, 4.45], 'concrete_ext', { surface: 'stone' });
    P.railing([-62, 0.22, 4.25], [25.5, 0.22, 4.25], { h: 1.0, mat: 'paint_grey', posts: 2.0 });
    L.clip([-64, 0, 4.05], [26, 3, 4.5]); L.clip([-64, 1.1, -4.6], [26, 3, -3.9]);
    L.solid([-64, -30, -14], [26, -1, -4.5], 'concrete_dark', { collide: false });
    for (let x = -60; x < 26; x += 12) L.visual([x - 0.02, 0, -4], [x + 0.02, 0.003, 4], 'rubber', { grime: false });
    for (const x of [-46, -30, -14, 2, 18]) { P.cyl([x, 0, 3.7], 0, [0, 2.6, 0], 0.06, 0.09, 5.2, 'paint_grey', { seg: 10 }); P.box([x, 0, 3.7], 0, [-0.16, 4.92, -1.05], [0.16, 5.05, -0.7], 'paint_black'); }
    // the gatehouse, with the lift we arrive in
    const R1 = { min: [26.4, 0, -7.4], max: [43.6, 4.4, 7.4] };
    L.solid([26.0, 0, -7.8], [44, 7.6, 7.8], 'concrete_ext');
    const entry = { pos: [24.4, 0, 2.6], rotY: -PI / 2 };
    L.cage({ ...entry, role: 'entry', text: 'THE CREST' });
    L.spawn = { pos: L.cageToWorld(entry, [0, 0, -0.3]), yaw: entry.rotY + PI };
    void R1;
    // the two of them at the parapet
    const v = L.npc({ name: 'varga', pos: [6.0, 0, -3.3], yaw: PI, anim: 'Idle_Rail_Loop', spec: VARGA });
    const b = L.npc({ name: 'brask', pos: [7.6, 0, -2.6], yaw: PI * 0.85, anim: 'Consume', spec: BRASK });
    void v; void b;
    P.bench([9.6, 0, -3.3], 0, { len: 1.8 });
    P.mug([9.2, 0.46, -3.25]);
    L.ext = buildExterior(L, { rain: false, water: -6, townDir: 1, dawn: true });
    L.trigger({ min: [-2, -1, -4], max: [14, 3, 4], onEnter: () => L.def.scene(L) });
  },
  start(L) {
    L.run(async s => {
      await s.wait(2);
      L.game.ui.hint('The rain has stopped.', 3500);
    });
  },
  scene(L) {
    const g = L.game;
    L.run(async s => {
      const v = L.named.varga, b = L.named.brask;
      b.play('Idle_Talking_Loop');
      await L.say('brask', 'Morning, Auditor. Foundations at seventy per cent of design. Nedre Kalden slept through the whole thing.', { channel: 'person' });
      b.play('Consume');
      v.face(PI * 0.5); v.play('Idle_Loop');
      await s.wait(1);
      await L.say('varga', 'Look at the water. Not a ripple. You would never know there was anything under it at all.', { channel: 'person' });
      v.play('Idle_Talking_Loop');
      await L.say('varga', 'My mother used to say everything good comes back up. She was wrong about that. But she was right that first you have to let go of the side of the barrel.', { channel: 'person' });
      audio.play('bell', { f: 196, gain: 0.45 });
      await s.wait(3.5);
      v.play('Idle_FoldArms_Loop');
      await L.say('varga', 'Well. What will you write in your report?', { channel: 'person' });
      await s.wait(1.2);
      g.ui.showDocument(DOCS.finalReport, () => { L.flags = { ...(L.flags || {}), read: true }; });
      await s.until(() => L.flags?.read);
      b.play('Idle_Talking_Loop');
      await L.say('brask', 'Coffee’s hot, this time.', { channel: 'person' });
      await s.wait(2);
      g.ending();
    });
  },
};
