// PROLOGUE — Arrival. The dam crest at night, the gatehouse, reception, the 1951
// orientation reel, and the instrument room where the auditor is issued a tare.
import * as THREE from 'three';
import { buildExterior } from '../render/sky.js';
import { signTexture, slideTexture } from '../render/signs.js';
import { audio } from '../core/audio.js';
import { DOCS } from './docs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function sodiumLamp(L, x, z, flicker = false) {
  const P = L.props;
  P.cyl([x, 0, z], 0, [0, 2.6, 0], 0.06, 0.09, 5.2, 'paint_grey', { seg: 10 });
  P.box([x, 0, z], 0, [-0.07, 5.05, -0.85], [0.07, 5.15, 0.05], 'paint_grey');
  P.box([x, 0, z], 0, [-0.16, 4.92, -1.05], [0.16, 5.05, -0.7], 'paint_black', { bevel: 0.02 });
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.3), L.game.engine.materials.emissive('#ffb35c', 5));
  lens.position.set(x, 4.91, z - 0.88); L.root.add(lens);
  const l = new THREE.PointLight('#ff9f45', 70, 26, 2);
  l.position.set(x, 4.8, z - 0.9);
  L.addLight(l, { flicker });
}

export default {
  id: 'prologue', ledger: 'P', chamber: 0, title: 'Arrival',
  tare: { enabled: false, capacity: 1 },
  build(L) {
    L.spawn = { pos: [-48, 0, 0], yaw: -Math.PI / 2 };
    L.killY = -12;
    L.wet = 1;
    L.fog('#0b0d0f', 0.016);
    L.env(0.25);
    L.reverb = 'outdoor';
    L.ambience = { room: 0, rain: 0.55, wind: 0.35, drips: 0, every: 6 };
    L.hemi('#3b4650', '#1c1a18', 0.35);
    const P = L.props;

    // ------------------------------------------------ the crest
    L.solid([-64, -1, -4], [26, 0, 4], 'slab_ext', { surface: 'stone', grime: false });
    L.solid([-64, 0, -4.5], [26, 1.05, -4.0], 'concrete_ext', { surface: 'stone' });
    L.solid([-64, 1.05, -4.6], [26, 1.15, -3.9], 'concrete_ext', { bevel: 0.02 });
    L.solid([-64, 0, 4.0], [26, 0.22, 4.45], 'concrete_ext', { surface: 'stone' });
    P.railing([-62, 0.22, 4.25], [25.5, 0.22, 4.25], { h: 1.0, mat: 'paint_grey', posts: 2.0 });
    L.clip([-64, 0, 4.05], [26, 3, 4.5]);
    L.clip([-64, 1.1, -4.6], [26, 3, -3.9]);
    // the dam's two faces falling away
    L.solid([-64, -30, -14], [26, -1, -4.5], 'concrete_dark', { collide: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(90, 160), L.mat('concrete_dark'));
    face.position.set(-19, -60, 40); face.rotation.x = -Math.PI / 2 + 0.68; L.root.add(face);
    // expansion joints in the crest every 12 m
    for (let x = -60; x < 26; x += 12) L.visual([x - 0.02, 0, -4], [x + 0.02, 0.003, 4], 'rubber', { grime: false });
    // kerb stones and a painted centre line, mostly worn away
    for (let x = -62; x < 24; x += 3.2) L.visual([x, 0, -0.05], [x + 1.6, 0.002, 0.05], L.game.engine.materials.plain('#b8ad8e', { rough: 0.9 }), { grime: false });
    for (const x of [-46, -30, -14, 2, 18]) sodiumLamp(L, x, 3.7, x === 2);
    // a bench, a bin, the funicular station behind the start
    P.bench([-36, 0, -3.3], 0, { len: 1.8 });
    L.solid([-62, 0, -3.6], [-53, 3.2, 3.6], 'concrete_ext');
    L.solid([-62.3, 3.2, -3.9], [-52.7, 3.45, 3.9], 'concrete_ext', { bevel: 0.03 });
    P.sign([-52.98, 2.55, 0], Math.PI / 2, ['KALDEN DAM · UPPER STATION'], { w: 3.2, h: 0.36, bg: '#24323a' });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), L.game.engine.materials.emissive('#ffcf8a', 0.8));
    win.position.set(-52.98, 1.6, -2.1); win.rotation.y = Math.PI / 2; L.root.add(win);
    P.bulkhead([-52.95, 2.3, 2.2], Math.PI / 2, { intensity: 12 });
    P.barrel([-54.2, 0, 3.0], { mat: 'paint_green' });

    // ------------------------------------------------ the gatehouse
    const R1 = { min: [26.4, 0, -7.4], max: [43.6, 4.4, 7.4] };
    L.room({ ...R1, wall: 'concrete_ext', inner: 'plaster_cream', dado: 'veneer_oak', dadoH: 1.25, floor: 'terrazzo', ceiling: 'plaster_grey', open: { 'x-': [[-0.8, 0.8, 0, 2.6]], 'x+': [[-0.8, 0.8, 0, 2.5]] } });
    L.solid([26.0, 4.4, -7.8], [44, 7.2, 7.8], 'concrete_ext');
    L.solid([25.6, 7.2, -8.2], [44.4, 7.6, 8.2], 'concrete_ext', { bevel: 0.04 });
    // canopy, lettering, the visitor scale
    L.solid([23.8, 2.95, -1.9], [26.0, 3.2, 1.9], 'concrete_ext', { bevel: 0.03 });
    for (const z of [-1.7, 1.7]) P.cyl([24.0, 0, z], 0, [0, 1.48, 0], 0.07, 0.07, 2.96, 'paint_black', { seg: 10 });
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.62), new THREE.MeshStandardMaterial({ map: signTexture(['STATE INSTITUTE OF PONDERAL MEASURES'], { style: 'plate', bg: '#2a2622', fg: '#b08d55', w: 2048, h: 140 }), metalness: 0.6, roughness: 0.4 }));
    letters.position.set(25.98, 4.6, 0); letters.rotation.y = -Math.PI / 2; L.root.add(letters);
    const plate = L.plate({ pos: [24.7, 0, 0], need: 2, dialAt: [24.6, 0, 1.25], dialRotY: -Math.PI / 2 });
    P.sign([25.97, 1.95, -1.25], -Math.PI / 2, ['ALL VISITORS', 'TO BE WEIGHED'], { w: 0.75, h: 0.36, bg: '#e6dcc2', fg: '#1d1b19' });
    P.bulkhead([25.97, 2.75, 1.25], -Math.PI / 2, { intensity: 16 });
    const front = L.door({ pos: [26.2, 0, 0], rotY: Math.PI / 2, w: 1.6, h: 2.6, when: plate, latch: true, mat: 'paint_green' });
    L.named.front = front;

    // reception
    L.solid([37.0, 0, -7.4], [41.6, 1.02, -6.2], 'veneer_walnut', { surface: 'wood' });
    L.solid([41.0, 0, -6.2], [41.6, 1.02, -3.4], 'veneer_walnut', { surface: 'wood' });
    L.solid([36.9, 1.02, -7.4], [41.7, 1.07, -6.1], 'veneer_oak', { bevel: 0.01 });
    L.solid([40.9, 1.02, -6.1], [41.7, 1.07, -3.3], 'veneer_oak', { bevel: 0.01 });
    P.phone([38.0, 1.07, -6.75], 0.3);
    P.ledger([39.3, 1.07, -6.75], 0.1, { open: true });
    P.mug([40.4, 1.07, -6.6]);
    P.deskLamp([37.4, 1.07, -6.9], 0.4);
    // the service bell
    P.cyl([40.0, 1.07, -6.45], 0, [0, 0.02, 0], 0.045, 0.05, 0.03, 'brass', { seg: 16 });
    L.note({ pos: [39.9, 1.075, -6.55], rotY: 0.2, doc: DOCS.appointment, onRead: () => L.def.onBadge?.(L) });
    L.note({ pos: [40.2, 1.076, -6.35], rotY: -0.3, doc: DOCS.braskWelcome });
    P.chair([38.8, 0, -7.85 + 1.1], Math.PI);
    P.bench([30.5, 0, -6.95], 0, { len: 2.2 });
    P.bench([30.5, 0, 6.95], Math.PI, { len: 2.2 });
    P.radiator([33.5, 0, -7.35], 0);
    P.radiator([33.5, 0, 7.35], Math.PI);
    for (const z of [3.2, 3.7, 4.2]) P.box([26.45, 1.75, z], 0, [0, -0.02, -0.02], [0.06, 0.02, 0.02], 'brass');
    P.coat([26.5, 1.75, 3.7], Math.PI / 2);
    P.clock([39.2, 3.2, -7.38], 0, { time: [21, 47] });
    P.poster([31.8, 2.05, 7.38], Math.PI, 'dam');
    P.poster([35.0, 2.05, 7.38], Math.PI, 'measure', { seed: 2 });
    L.note({ pos: [37.6, 2.0, 7.37], rotY: Math.PI, kind: 'photo', wall: true, doc: DOCS.photoOpening });
    P.sign([43.57, 2.95, 0], -Math.PI / 2, ['ORIENTATION'], { w: 1.3, h: 0.22 });
    // intercom panel by the inner door
    P.box([43.55, 1.5, 1.4], -Math.PI / 2, [-0.14, -0.2, 0], [0.14, 0.2, 0.06], 'paint_cream', { bevel: 0.01 });
    P.grille([43.48, 1.6, 1.4], -Math.PI / 2, { w: 0.18, h: 0.12 });
    P.pendant([31.0, 4.4, 0], { intensity: 26, drop: 0.9 });
    P.pendant([38.5, 4.4, 0], { intensity: 26, drop: 0.9, shadow: true });
    P.fluoro([39.2, 4.38, -5.0], { len: 1.2, intensity: 26 });
    L.fill([35, 2.4, 0], { radius: 14, intensity: 1.4 });
    const inner = L.door({ pos: [43.8, 0, 0], rotY: Math.PI / 2, w: 1.6, h: 2.5, when: () => L.flags.badge, latch: true });
    void inner;

    // ------------------------------------------------ orientation room
    const R2 = { min: [44.0, 0, -4.6], max: [53.6, 4.0, 4.0] };
    L.room({ ...R2, walls: ['x+', 'z-', 'z+'], wall: 'plaster_blue', dado: 'tile_green', dadoH: 1.1, floor: 'lino_oxblood', open: { 'x+': [[2.0, 3.6, 0, 2.5]] } });
    for (let r = 0; r < 3; r++) for (const x of [46.2, 50.6]) P.bench([x, 0, -1.3 + r * 1.3], Math.PI, { len: 2.6 });
    // screen on the south wall
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.25), new THREE.MeshStandardMaterial({ map: slideTexture(0), roughness: 0.9, emissive: '#ffffff', emissiveMap: slideTexture(0), emissiveIntensity: 0.0 }));
    scr.position.set(48.8, 2.2, -4.57); L.root.add(scr);
    L.visual([47.1, 0.95, -4.6], [50.5, 3.4, -4.58], L.game.engine.materials.plain('#1a1917', { rough: 0.9 }), { grime: false });
    L.named.screen = scr;
    // projector on a trolley at the back
    P.box([48.8, 0, 3.0], 0, [-0.35, 0, -0.25], [0.35, 0.95, 0.25], 'paint_grey', { bevel: 0.01 });
    P.box([48.8, 0, 3.0], 0, [-0.18, 0.95, -0.24], [0.18, 1.2, 0.2], 'paint_black', { bevel: 0.02 });
    P.cyl([48.8, 0, 3.0], 0, [0, 1.08, -0.3], 0.06, 0.07, 0.14, 'paint_black', { axis: 'z', seg: 14 });
    for (const [z, y] of [[0.05, 1.42], [0.05 - 0.36, 1.42]]) { const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), L.mat('steel_dark')); reel.rotation.z = Math.PI / 2; reel.position.set(48.8, y, 3.0 + z); L.root.add(reel); (L.reels ||= []).push(reel); }
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.45, 7.3, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(48.8, 1.65, -0.67); beam.rotation.x = -Math.PI / 2 - 0.07; L.root.add(beam);
    L.named.beam = beam;
    const proj = new THREE.SpotLight('#fff1d2', 0, 10, 0.26, 0.4, 1.5);
    proj.position.set(48.8, 1.1, 2.6); proj.target.position.set(48.8, 2.2, -4.6);
    L.addLight(proj); L.root.add(proj.target);
    L.named.projLight = proj;
    P.pendant([48.8, 4.0, 0.5], { intensity: 14, drop: 0.7 });
    L.named.roomLight = L.lights[L.lights.length - 1];
    L.fill([48.8, 2.2, 0], { radius: 9, intensity: 0.7, color: '#e9dcc8' });
    P.sign([53.57, 2.95, 2.8], -Math.PI / 2, ['INSTRUMENTS'], { w: 1.3, h: 0.22 });
    L.door({ pos: [53.8, 0, 2.8], rotY: Math.PI / 2, w: 1.6, h: 2.5, when: () => L.flags.reelDone, latch: true });
    L.trigger({ min: [45, -1, -3.6], max: [52.6, 3, 2.5], onEnter: () => L.def.playReel(L) });

    // ------------------------------------------------ instrument room
    const R3 = { min: [54.0, 0, -4.6], max: [62.0, 4.0, 4.0] };
    const exit = L.cageSpot(R3, 'x+', -0.6);
    L.room({ ...R3, walls: ['x+', 'z-', 'z+'], wall: 'plaster_cream', dado: 'tile_cream', dadoH: 1.3, floor: 'lino_grey', open: { 'x+': [exit.open] } });
    // workbench with the instrument case
    L.solid([55.0, 0, -4.5], [58.4, 0.9, -3.6], 'veneer_oak', { surface: 'wood', bevel: 0.01 });
    P.weightSet([55.7, 0.9, -4.05], 0);
    P.balanceScale([57.9, 0.9, -4.1], 0);
    P.box([56.8, 0.9, -4.05], 0.0, [-0.3, 0, -0.2], [0.3, 0.12, 0.2], 'veneer_walnut', { bevel: 0.01 });
    P.box([56.8, 0.9, -4.05], 0.0, [-0.27, 0.12, -0.17], [0.27, 0.125, 0.17], L.game.engine.materials.plain('#5a2230', { rough: 1 }));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.4), L.mat('veneer_walnut'));
    lid.position.set(56.8, 1.2, -4.27); lid.rotation.x = -1.25; L.root.add(lid);
    // the tare itself, lying in its case
    const tareProp = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.11, 20), L.mat('brass')); housing.rotation.z = Math.PI / 2; tareProp.add(housing);
    for (const s of [-1, 1]) { const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.14, 8), L.mat('brass')); pr.rotation.z = Math.PI / 2; pr.position.set(0.12, 0, s * 0.011); tareProp.add(pr); }
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.019, 0.11, 14), L.mat('bakelite')); grip.rotation.z = Math.PI / 2; grip.position.set(-0.11, -0.01, 0); tareProp.add(grip);
    tareProp.position.set(56.8, 1.06, -4.05); tareProp.rotation.y = 0.2;
    L.root.add(tareProp);
    L.named.tareProp = tareProp;
    L.interactable({ pos: [56.8, 1.05, -4.05], half: [0.3, 0.12, 0.2], prompt: 'Take the tare', onUse: () => L.def.takeTare(L) });
    // the practice scale
    const pp = L.plate({ pos: [58.5, 0, 0.6], need: 2, dialAt: [59.4, 0, -0.4], dialRotY: -Math.PI / 2 - 0.4 });
    L.crate({ pos: [58.5, 0, 0.6], weight: 1 });
    L.crate({ pos: [56.4, 0, 1.6], weight: 1, rotY: 0.3 });
    L.named.practice = pp;
    P.shelf([55.4, 0, 3.75], Math.PI, { w: 2.4, h: 2.0, seed: 9 });
    P.cabinet([61.5, 0, -3.9], 0);
    P.fluoro([56.0, 3.98, -2.0], { len: 1.3, intensity: 40 });
    P.fluoro([59.6, 3.98, 1.0], { len: 1.3, intensity: 40, shadow: true });
    P.poster([60.2, 2.0, -4.58], 0, 'quiet');
    L.fill([58, 2.2, 0], { radius: 9, intensity: 0.8, color: '#f0e6d4' });
    L.cage({ ...exit, role: 'exit', when: () => L.flags.practiceDone, text: 'LEDGER I' });

    // ------------------------------------------------ outdoors
    L.ext = buildExterior(L, { rainBox: [-80, -200, -200, 25.9, 200, 200], water: -6, townDir: 1 });
    L.flags = {};
  },

  // Title-screen camera: a slow drift along the crest in the rain.
  titleCamera(L, cam, t) {
    const x = -24 + Math.sin(t * 0.04) * 3;
    cam.position.set(x, 1.75 + Math.sin(t * 0.3) * 0.03, -1.6);
    cam.lookAt(x + 30, 2.2, 0.6);
  },

  start(L) {
    L.flags = {};
  },

  begin(L) {
    L.run(async s => {
      await s.wait(2.5);
      await L.say('varga', 'Visitor on the crest. The Institute is expecting you. Please proceed to the gatehouse and present yourself on the weighing plate.');
      await s.wait(1.5);
      await L.say('varga', 'Mind the puddles. They are heavier than they look.', { chime: false });
    });
    L.game.ui.hint('Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · look with the mouse · <kbd>Space</kbd> to jump', 7000);
    let weighed = false;
    L.onUpdate(() => {
      if (!weighed && L.named.front?.latched) {
        weighed = true;
        L.say('varga', 'Two measures. Thank you. Welcome to the Weighing House.');
        L.run(async s => {
          await s.until(() => L.game.player.pos.x > 28.5);
          await s.wait(0.8);
          await L.say('brask', 'Evening. You’ll be the auditor from the Bureau. Brask — Senior Weigher. Which these days means the only weigher.');
          await L.say('brask', 'The Director asks that you be familiarised before you see the books. Procedure, apparently. Your papers are on the desk.');
          L.game.ui.hint('Look at a document and press <kbd>E</kbd> to read it', 6000);
        });
      }
    });
  },

  onBadge(L) {
    if (L.flags.badge) return;
    L.flags.badge = true;
    L.run(async () => {
      await L.say('brask', 'Orientation’s through the far door. Sit anywhere. The film’s older than both of us.');
    });
  },

  playReel(L) {
    if (L.flags.reel) return;
    L.flags.reel = true;
    const scr = L.named.screen;
    const setSlide = n => { scr.material.map = slideTexture(n); scr.material.emissiveMap = slideTexture(n); scr.material.needsUpdate = true; audio.play('flap', { count: 2 }); };
    L.run(async s => {
      const light = L.named.roomLight;
      const base = light ? light.intensity : 0;
      for (let i = 0; i <= 20; i++) { if (light) light.intensity = base * (1 - i / 20) * 0.6 + base * 0.1; await s.wait(0.05); }
      L.named.projLight.intensity = 18; L.named.beam.material.opacity = 0.05; scr.material.emissiveIntensity = 0.55;
      const hum = audio.loop('hiss', { gain: 0.25, pos: V(48.8, 1.2, 3.0) });
      L.reelSpin = true;
      setSlide(0);
      await s.wait(1.2);
      await L.say('reel', 'Welcome to the State Institute of Ponderal Measures. You are standing inside the Kalden Dam, completed in the second year of the Plan.');
      setSlide(1);
      await L.say('reel', 'Weight, we were taught, is a property of things. It is not. Weight is a debt that every body owes the earth — and like any debt, it may be transferred.');
      setSlide(2);
      await L.say('reel', 'The instrument you will be issued is called a tare. With it, a qualified person may draw a measure out of one body and give it to another.');
      setSlide(3);
      await L.say('reel', 'Nothing is lost. Nothing is created. The Institute keeps a ledger of every measure in its care. In time, so will you.');
      setSlide(4);
      await L.say('reel', 'Doctor Ottilie Varga, Director. Kalden, nineteen fifty-one.');
      await s.wait(1.5);
      hum?.stop(0.5); L.reelSpin = false;
      L.named.projLight.intensity = 0; L.named.beam.material.opacity = 0; scr.material.emissiveIntensity = 0;
      if (light) light.intensity = base;
      L.flags.reelDone = true;
      await L.say('brask', 'She was twenty-nine when they filmed that. Come through to the instrument room.');
    });
  },

  takeTare(L) {
    if (L.flags.tare) return;
    L.flags.tare = true;
    L.named.tareProp.visible = false;
    const g = L.game;
    g.tare.enabled = true; g.tare.show(true);
    audio.play('tare', { give: true, stored: 0 });
    L.run(async s => {
      await L.say('brask', 'Careful — it’s older than it looks. Point it at something. Left hand draws a measure out. Right hand gives one back.');
      g.ui.hint('<kbd>Left mouse</kbd> draw a measure · <kbd>Right mouse</kbd> give it · the vials on the instrument show what you carry', 9000);
      await L.say('brask', 'That scale by the bench wants two. The crate on it has one. Have a go.');
      await s.until(() => L.named.practice.pressed);
      L.flags.practiceDone = true;
      await s.wait(0.6);
      await L.say('brask', 'That’s it. That’s all of it, really. The rest is bookkeeping.');
      await L.say('varga', 'Auditor. Before you inspect our accounts, the Institute requires you to complete the familiarisation procedure. Every visitor does. The lift will take you down to Ledger One.');
    });
  },

  update(L, dt) {
    if (L.reelSpin && L.reels) for (const r of L.reels) r.rotation.x += dt * 3;
  },
};
