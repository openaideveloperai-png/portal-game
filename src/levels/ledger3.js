// LEDGER III — The Debt. Your own weight: light, heavy, less than nothing. The turbine
// hall, the spillway in the storm, the floating village of Halde, and the vault.
import * as THREE from 'three';
import { shell, chamberPlate, obsWindow, ceilingPipes } from './kit.js';
import { DOCS } from './docs.js';
import { buildExterior } from '../render/sky.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/util.js';

const PI = Math.PI;
const VARGA = { name: 'Varga', body: 'f', skin: 'light', outfit: 'varga', hair: 'parted', hairColor: '#bdb8ae', grey: 0.95, glasses: true, posture: 0.06, age: 1 };
const BRASK = { name: 'Brask', body: 'm', skin: 'light', outfit: 'brask', hair: 'parted', beard: true, hairColor: '#aaa49a', grey: 0.85, belly: 0.05, posture: 0.08, age: 1 };

// ------------------------------------------------------------------ III·1  Self-tare
const c18 = {
  id: 'c18', ledger: 'III', chamber: 1, title: 'Self-Tare',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-7, 0, -6], max: [7, 6, 6], theme: 'calib', entry: { wall: 'x-', a: 3.6, text: 'LEDGER III  1' }, exit: { wall: 'x+', a: 4.0, y: 2.0, when: () => L.named.p.latched },
      lights: [[-3.5, -3], [3.5, -3, { shadow: true }], [-3.5, 3], [3.5, 3]] });
    L.solid([3.2, 0, 2.0], [7, 2.0, 6], 'terrazzo_dark', { bevel: 0.02 });
    L.props.sign([3.2, 1.3, 1.98], PI, ['LEDGE 2.0 M'], { w: 0.7, h: 0.15, bg: '#c39a3c', fg: '#1d1b19' });
    L.booth({ pos: [-5.6, 0, -3.4], rotY: PI / 2, range: [1, 4], name: 'booth' });
    L.anchor({ pos: [-3.3, 0, -3.4], weight: 2 });
    const p = L.plate({ pos: [1.2, 0, -3.6], need: 4, dialAt: [2.4, 0, -4.6], dialRotY: -PI * 0.8 });
    L.named.p = p;
    L.onUpdate(() => { if (p.pressed) p.latched = true; });
    L.wire({ from: () => p.latched, points: [[1.7, -3.6], [6.6, -3.6], [6.6, 1.8], [6.6, 2.0, 2.4]] });
    chamberPlate(L, [-6.97, 2.1, 1.0], PI / 2, 'III', 1);
    L.note({ pos: [-5.0, 1.55, -4.6], rotY: 0, wall: true, doc: DOCS.boothPermit });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Self-tare booth. Step in, point your fork at the dial, and it’ll treat you like any other body.');
      await L.say('brask', 'Heavier, you press harder. Lighter, you jump higher. Same legs either way.');
      L.game.ui.hint('Inside a booth, aim at its dial: <kbd>Left mouse</kbd> draws from you, <kbd>Right mouse</kbd> gives to you', 8000);
    });
  },
};

// ------------------------------------------------------------------ III·2  Featherweight
const c19 = {
  id: 'c19', ledger: 'III', chamber: 2, title: 'Featherweight',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-6, 0, -6], max: [6, 14, 6], theme: 'service', entry: { wall: 'z-', a: -3, text: 'LEDGER III  2' }, exit: { wall: 'x+', a: 1.5, y: 10.0, when: () => L.named.p.pressed },
      lights: [[-3, -3], [3, -3], [-3, 3, { shadow: true }], [3, 3]], fill: 1.4 });
    L.solid([3.6, 9.7, -1.5], [6, 10.0, 6], 'grating', { surface: 'metal' });
    L.props.railing([3.65, 10.0, 2.6], [3.65, 10.0, 5.95], { h: 1.0 });
    L.vent({ pos: [2.5, 0, 0.5], size: [2.0, 2.0], height: 11.2, strength: 1.5 });
    L.booth({ pos: [-4.6, 0, -1.5], rotY: PI / 2, range: [0, 3] });
    const p = L.plate({ pos: [4.9, 10.0, -0.6], need: 2, dialAt: [5.6, 10.0, 0.8], dialRotY: -PI * 0.75 });
    L.named.p = p;
    L.crate({ pos: [-1.5, 0, 3.5], weight: 1 });
    L.props.sign([2.5, 2.4, 5.97], PI, ['UPDRAUGHT', 'LIFTS ONE MEASURE OR LESS'], { w: 1.3, h: 0.34 });
    L.props.ladder([-5.95, 0, 4.0], PI / 2, 9.5);
    chamberPlate(L, [-1.4, 2.1, -5.97], 0, 'III', 2);
    ceilingPipes(L, [-6, 5.5], [6, 5.5], { y: 14 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Exhaust shaft. The draught will lift anything of one measure or less. Anything.');
    });
  },
};

// ------------------------------------------------------------------ III·3  Heavyweight
const c20 = {
  id: 'c20', ledger: 'III', chamber: 3, title: 'Heavyweight',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-6, 0, -7], max: [6, 9, 7], theme: 'calib3', entry: { wall: 'z+', a: -2.8, y: 4.5, text: 'LEDGER III  3' }, exit: { wall: 'z-', a: 2.8, when: () => L.named.p.latched },
      lights: [[-3, -4], [3, -4, { shadow: true }], [-3, 4], [3, 4]] });
    for (const [a, b] of [[[-6, 4.2, 0], [-1.3, 4.5, 7]], [[1.3, 4.2, 0], [6, 4.5, 7]], [[-1.3, 4.2, 0], [1.3, 4.5, 1.6]], [[-1.3, 4.2, 4.2], [1.3, 4.5, 7]]]) L.solid(a, b, 'terrazzo', { bevel: 0.01 });
    L.glass({ min: [-1.3, 4.38, 1.6], max: [1.3, 4.5, 4.2], limit: 4 });
    L.props.railing([-5.95, 4.5, 0.05], [5.95, 4.5, 0.05], { h: 1.05, posts: 1.5 });
    L.booth({ pos: [-4.4, 4.5, 4.8], rotY: PI / 2, range: [2, 5] });
    L.anchor({ pos: [-2.2, 4.5, 5.4], weight: 3 });
    const p = L.plate({ pos: [3.4, 0, -3.6], need: 5, dialAt: [4.6, 0, -2.6], dialRotY: -PI * 0.7 });
    L.named.p = p;
    L.onUpdate(() => { if (p.pressed) p.latched = true; });
    L.crate({ pos: [-3.8, 0, -4.4], weight: 1 });
    L.wire({ from: () => p.latched, points: [[3.4, -4.2], [3.4, -6.6], [2.8, -6.6]] });
    chamberPlate(L, [-1.4, 6.6, 6.97], PI, 'III', 3);
    L.props.sign([0, 4.9, 4.25], PI, ['INSPECTION GLASS — MAX 4'], { w: 1.2, h: 0.15, bg: '#c39a3c', fg: '#1d1b19' });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'You have been in my office, Auditor. Teodor tells me you read my letters. Did you find the arithmetic in order?');
      await L.say('varga', 'Weighing yourself is a lonely business. You will find you have no one else to blame for the result.', { chime: false });
    });
  },
};

// ------------------------------------------------------------------ III·4  Spring
const c21 = {
  id: 'c21', ledger: 'III', chamber: 4, title: 'Trajectory',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-12, 0, -5], max: [12, 14, 5], theme: 'service', holes: [[-4, -5, 4.5, 5], [8.6, -5, 12, 5]], entry: { wall: 'x-', a: 0, text: 'LEDGER III  4' }, exit: { wall: 'z+', a: 6.3, when: () => L.named.p.pressed },
      lights: [[-8, 0], [0, -2.5, { shadow: true }], [6, 0]], fill: 1.2 });
    L.killY = -4;
    L.solid([-4, -6, -5], [4.5, -5.6, 5], 'concrete_dark');
    L.solid([8.6, -6, -5], [12, -5.6, 5], 'concrete_dark');
    L.solid([8.2, 0, -5], [8.6, 2.4, 5], 'paint_ochre', { surface: 'metal', bevel: 0.03 });
    L.props.sign([8.18, 1.5, 0], -PI / 2, ['BUFFER'], { w: 0.8, h: 0.22, bg: '#1d1b19', fg: '#c39a3c' });
    L.brine({ min: [-4, -5.6, -5], max: [4.5, -3.5, 5] });
    L.brine({ min: [8.6, -5.6, -5], max: [12, -3.5, 5] });
    for (const x of [-4.05, 4.55]) L.visual([x - 0.04, -0.05, -5], [x + 0.04, 0.02, 5], 'paint_ochre', { grime: false });
    L.launcher({ pos: [-6.5, 0, 0], vel: [8.6, 7.0, 0], delay: 0.8 });
    const p = L.plate({ pos: [6.6, 0, -2.2], need: 4, dialAt: [7.6, 0, -3.4], dialRotY: -PI * 0.7 });
    L.named.p = p;
    L.crate({ pos: [-9.5, 0, -3.2], weight: 1 });
    L.crate({ pos: [-9.6, 0, 3.0], weight: 3 });
    L.props.sign([-6.5, 2.4, -4.97], 0, ['SPRING PLATE', 'CALIBRATED FOR TWO MEASURES'], { w: 1.4, h: 0.36 });
    chamberPlate(L, [-11.97, 2.1, -2.6], PI / 2, 'III', 4);
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Spring plate. Throws whatever stands on it. Calibrated for two — anything lighter goes further, anything heavier doesn’t.');
    });
  },
};

// ------------------------------------------------------------------ III·5  Turbine hall
const c22 = {
  id: 'c22', ledger: 'III', chamber: 5, title: 'Turbine Hall',
  tare: { capacity: 4, debt: true },
  build(L) {
    shell(L, { min: [-16, 0, -10], max: [16, 16, 10], theme: 'service', mats: { wall: 'concrete', floor: 'slab' }, entry: { wall: 'x-', a: 6, text: 'LEDGER III  5' }, exit: { wall: 'x+', a: -6, y: 10.0, when: true },
      lights: [], fill: 1.4, hemi: 0.6 });
    L.reverb = 'vast';
    L.ambience = { room: 0.4, machine: 0.6, machinePos: [0, 2, 0], creaks: 0.3, knocks: 0.4, every: 3 };
    L.fog('#14120f', 0.018);
    for (const x of [-10, 0, 10]) for (const z of [-6, 6]) L.props.pendant([x, 16, z], { intensity: 70, drop: 3, shade: 'paint_green', distance: 22, shadow: x === 0 && z === -6 });
    // three turbine housings
    const mats = L.game.engine.materials;
    for (const [i, x] of [-10, 0, 10].entries()) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 4.2, 40), mats.get(i === 2 ? 'paint_red' : 'paint_green', { param: 0.35 }));
      h.position.set(x, 2.1, 0); h.castShadow = h.receiveShadow = true; L.root.add(h);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 0.9, 40), mats.get('steel_dark'));
      cap.position.set(x, 4.65, 0); L.root.add(cap);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 24), mats.get('brass'));
      hub.position.set(x, 5.6, 0); L.root.add(hub);
      L.phys.fixedCollider(L.R.ColliderDesc.cylinder(2.55, 3.3).setTranslation(x, 2.55, 0), { kind: 'static', surface: 'metal' });
      L.props.sign([x, 3.2, 3.42], 0, [`GENERATOR ${i + 1}`], { w: 1.4, h: 0.26, style: 'plate', bg: '#b89a5a', fg: '#2a2218' });
    }
    // high gantry with the exit
    L.solid([12, 9.7, -10], [16, 10.0, -2], 'grating', { surface: 'metal' });
    L.props.railing([12.05, 10.0, -9.9], [12.05, 10.0, -2.1], { h: 1.0 });
    // the exhaust vent of generator 3, dead until its brake is released
    const p = L.plate({ pos: [-12.5, 0, -7.0], need: 6, size: 1.4, dialAt: [-11.2, 0, -8.4], dialRotY: PI * 0.8 });
    L.named.p = p;
    L.onUpdate(() => { if (p.pressed) p.latched = true; });
    L.vent({ pos: [14.0, 0, -0.7], size: [2.2, 2.2], height: 10.8, strength: 2.5, on: () => p.latched });
    L.wire({ from: () => p.latched, points: [[-12.5, -6.2], [-12.5, -8.6], [12.4, -8.6], [12.4, -0.7]] });
    L.booth({ pos: [-14.2, 0, 2.5], rotY: PI / 2, range: [1, 4] });
    L.anchor({ pos: [-11.8, 0, 2.8], weight: 2 });
    L.crate({ pos: [-6, 0, 7.5], weight: 2 });
    L.props.sign([15.97, 3.0, -0.7], -PI / 2, ['EXHAUST 3', 'BRAKE RELEASE AT PANEL WEST'], { w: 1.5, h: 0.36 });
    L.props.panel([-15.97, 1.6, -7.0], PI / 2);
    L.props.pipeRun([[-16, 12, 9.6], [16, 12, 9.6]], { r: 0.3, mat: 'paint_green' });
    L.props.pipeRun([[-16, 12.8, 9.0], [16, 12.8, 9.0]], { r: 0.18, mat: 'rust' });
    // the overhead crane
    L.solid([-16, 13.6, -1.0], [16, 14.2, -0.4], 'paint_ochre', { collide: false });
    L.solid([-16, 13.6, 0.4], [16, 14.2, 1.0], 'paint_ochre', { collide: false });
    L.solid([2.0, 13.2, -1.2], [3.6, 13.6, 1.2], 'paint_black', { collide: false });
    L.note({ pos: [-14.6, 1.6, -9.97], rotY: 0, wall: true, doc: DOCS.turbineLog });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'Generators one, two and three. They have not turned since nineteen seventy-one. The dam stopped making power when it started carrying Halde.');
      await L.say('brask', 'The exhaust on three still draws, if you can get its brake off. The brake wants six on the west plate.', { chime: false });
    });
  },
};

// ------------------------------------------------------------------ III·6  Inversion
const c23 = {
  id: 'c23', ledger: 'III', chamber: 6, title: 'Less Than Nothing',
  tare: { capacity: 4, debt: true },
  build(L) {
    shell(L, { min: [-9, 0, -5], max: [9, 7, 5], theme: 'calib2', holes: [[-4, -5, 4, 5]], entry: { wall: 'x-', a: -2, text: 'LEDGER III  6' }, exit: { wall: 'x+', a: 2.0, when: true },
      lights: [[-6.5, -2.5], [-6.5, 2.5], [5.2, 2.5, { shadow: true }], [8.0, -2.5]] });
    L.killY = -9; L.killYTop = 12;
    L.solid([-4, -10, -5], [4, -9.6, 5], 'concrete_dark');
    for (const x of [-4.05, 4.05]) L.props.railing([x, 0, -4.9], [x, 0, 4.9], { h: 1.0, posts: 1.6 });
    L.booth({ pos: [-6.0, 0, 3.6], rotY: PI / 2, range: [-2, 2], post: true });
    L.booth({ pos: [5.4, 7.0, -3.4], rotY: -PI / 2, range: [-2, 2], post: true, hang: true });
    // a door on the far side, opened by a ceiling plate over the pit
    const cp = L.plate({ pos: [0, 7, 0], need: 2, ceiling: true, size: 1.4, dialAt: [1.4, 7, 0.0], dialRotY: 0 });
    L.named.cp = cp;
    L.onUpdate(() => { if (cp.pressed) cp.latched = true; });
    L.solid([6.5, 0, -5], [6.9, 7, -1.0], 'plaster_cream');
    L.solid([6.5, 0, 1.0], [6.9, 7, 5], 'plaster_cream');
    L.solid([6.5, 2.6, -1.0], [6.9, 7, 1.0], 'plaster_cream');
    L.door({ pos: [6.7, 0, 0], rotY: PI / 2, w: 2.0, h: 2.6, when: () => cp.latched, latch: true });
    L.props.sign([-4.5, 6.5, -4.97], 0, ['CEILING WALKWAY', 'USE THE SELF-TARE POST'], { w: 1.3, h: 0.34 });
    chamberPlate(L, [-8.97, 2.1, 2.0], PI / 2, 'III', 6);
    // painted footprints on the ceiling, upside down: someone did this before
    for (let i = 0; i < 9; i++) {
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.3), L.game.engine.materials.plain('#d8cdb2', { rough: 0.9, side: THREE.DoubleSide }));
      fp.rotation.x = PI / 2; fp.position.set(-5.5 + i * 1.3, 6.985, (i % 2 ? 0.18 : -0.18)); L.root.add(fp);
    }
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Below zero, you fall the other way. Same as any crate. The ceiling’s as good a floor as any, once you’re standing on it.');
      await L.say('brask', 'There’s a post on the far side to put you right again. Mind your head.', { chime: false });
    });
  },
};

// ------------------------------------------------------------------ III·7  The spillway
const c24 = {
  id: 'c24', ledger: 'III', chamber: 7, title: 'Spillway',
  tare: { capacity: 4, debt: true },
  build(L) {
    L.spawn = { pos: [-14, 0, 0], yaw: -PI / 2 };
    L.killY = -14; L.killYTop = 30;
    L.wet = 1;
    L.fog('#0b0d0f', 0.02);
    L.env(0.25);
    L.reverb = 'outdoor';
    L.ambience = { room: 0, rain: 0.7, wind: 0.5, water: 0.9, waterPos: [0, -8, 0], every: 6 };
    L.hemi('#3b4650', '#1c1a18', 0.4);
    // west bank, the bridge over the spillway, east bank
    L.solid([-24, -1, -6], [-6, 0, 6], 'slab_ext', { surface: 'stone', grime: false });
    L.solid([6, -1, -6], [24, 0, 6], 'slab_ext', { surface: 'stone', grime: false });
    L.solid([-6.5, 5.6, -2.2], [6.5, 6.4, 2.2], 'concrete_ext');
    L.solid([-9, 5.6, -2.2], [-6.5, 6.4, 2.2], 'concrete_ext');
    L.solid([6.5, 5.6, -2.2], [9, 6.4, 2.2], 'concrete_ext');
    for (const x of [-9, 9]) L.solid([x - 0.4, 0, -2.2], [x + 0.4, 5.6, 2.2], 'concrete_ext');
    // the torrent
    L.solid([-6, -12, -8], [6, -11, 8], 'concrete_dark');
    L.brine({ min: [-6, -11, -8], max: [6, -8.5, 8], current: [0, 4.5] });
    const torrent = new THREE.Mesh(new THREE.PlaneGeometry(12, 30, 1, 1), new THREE.MeshStandardMaterial({ color: '#c9cfcc', roughness: 0.3, transparent: true, opacity: 0.18 }));
    torrent.rotation.x = -PI / 2; torrent.position.set(0, -8.45, 0); L.root.add(torrent);
    L.named.torrent = torrent;
    for (const x of [-6, 6]) L.solid([x - (x < 0 ? 0.5 : 0), -11, -8], [x + (x > 0 ? 0.5 : 0), 0, 8], 'concrete_dark');
    L.props.railing([-24, 0, -5.9], [-6.2, 0, -5.9], { h: 1.0, mat: 'paint_grey', posts: 2 });
    L.props.railing([-6.2, 0, -5.9], [-6.2, 0, 5.9], { h: 1.0, mat: 'paint_grey', posts: 2 });
    L.props.railing([6.2, 0, -5.9], [6.2, 0, 5.9], { h: 1.0, mat: 'paint_grey', posts: 2 });
    L.clip([-24, 0, -6], [24, 4, -5.8]); L.clip([-24, 0, 5.8], [24, 4, 6]);
    L.clip([-6.3, 0, -6], [-6.1, 4, 6]); L.clip([6.1, 0, -6], [6.3, 4, 6]);
    L.booth({ pos: [-7.6, 0, 0], rotY: PI / 2, range: [-2, 2], post: true });
    L.booth({ pos: [7.8, 5.6, 0], rotY: -PI / 2, range: [-2, 2], post: true, hang: true });
    // sodium lamps and the gatehouse for the exit
    const exitRoom = { min: [16, 0, -3], max: [22, 3.4, 3] };
    const exit = L.cageSpot(exitRoom, 'x+', 0);
    L.room({ ...exitRoom, wall: 'concrete_ext', inner: 'plaster_grey', floor: 'slab', open: { 'x-': [[-1, 1, 0, 2.6]], 'x+': [exit.open] } });
    L.cage({ ...exit, role: 'exit', when: true, text: 'THE BELL' });
    L.props.bulkhead([15.97, 2.9, 0], -PI / 2, { intensity: 18 });
    L.fill([19, 1.8, 0], { radius: 6, intensity: 0.8 });
    for (const x of [-18, 12]) { L.props.cyl([x, 0, -5.2], 0, [0, 2.6, 0], 0.06, 0.09, 5.2, 'paint_grey', { seg: 10 }); const l = new THREE.PointLight('#ff9f45', 70, 26, 2); l.position.set(x, 4.9, -4.6); L.addLight(l); }
    const under = new THREE.PointLight('#ffcf94', 14, 12, 2); under.position.set(0, 4.6, 0); L.addLight(under);
    L.props.sign([-7.3, 3.0, -2.25], 0, ['SPILLWAY BRIDGE — CLOSED'], { w: 1.6, h: 0.22, bg: '#7d2a1f' });
    L.solid([-6.5, 6.4, -0.6], [6.5, 7.6, 0.6], 'concrete_ext');
    L.ext = buildExterior(L, { rainBox: [-40, -40, -40, 15.9, 60, 40], water: -9, town: true, townDir: 1 });
    L.note({ pos: [-12, 1.2, 5.6], rotY: PI, wall: true, doc: DOCS.engineerLetter });
    L.props.box([-12, 0, 5.7], 0, [-0.4, 0, -0.1], [0.4, 1.4, 0.1], 'concrete_ext');
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'Do you hear it, Auditor? The spillway. Every gate open since spring. The reservoir is trying to lighten the dam on its own.');
      await L.say('varga', 'The bridge is closed. You will have to go under it. You are quite good at being less than nothing now.', { chime: false });
      await s.until(() => L.game.player.pos.x > 9);
      await L.say('brask', 'You’re over. The Bell’s through the gatehouse and down. She’s already there.');
    });
  },
  update(L, dt) { if (L.named.torrent) L.named.torrent.material.opacity = 0.16 + Math.sin(L.game.engine.time * 7) * 0.03; },
};

// ------------------------------------------------------------------ III·8  The Bell (Halde)
const c25 = {
  id: 'c25', ledger: 'III', chamber: 8, title: 'Halde',
  tare: { capacity: 4, debt: true },
  playerWeight: 2,
  build(L) {
    L.spawn = { pos: [-24, 4, 0], yaw: -PI / 2 };
    L.killY = -6;
    L.fog('#0c0f10', 0.028);
    L.env(0.3);
    L.reverb = 'vast';
    L.ambience = { room: 0.3, drone: 0.35, drips: 1.0, creaks: 0.6, every: 1.8 };
    L.hemi('#56646a', '#2a2622', 0.45);
    const mats = L.game.engine.materials;
    // the lake bed and the inside of the caisson
    L.solid([-60, -2, -60], [60, 0, 60], 'mud', { surface: 'mud', grime: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 24, 0, PI * 2, 0, PI / 2), mats.get('concrete_dark'));
    dome.material.side = THREE.BackSide; dome.position.y = -6; dome.scale.y = 0.62; L.root.add(dome);
    // the landing stage
    const entryRoom = { min: [-30, 4, -3], max: [-24, 7, 3] };
    const entry = L.cageSpot(entryRoom, 'x-', 0, { y: 4 });
    L.solid([-30, 3.6, -3], [-21.5, 4, 3], 'planks_grey', { surface: 'wood' });
    L.props.railing([-30, 4, -2.95], [-21.6, 4, -2.95], { h: 1.0, mat: 'paint_grey' });
    L.props.railing([-30, 4, 2.95], [-21.6, 4, 2.95], { h: 1.0, mat: 'paint_grey' });
    for (const [x, z] of [[-29, -2.6], [-29, 2.6], [-22, -2.6], [-22, 2.6]]) L.props.cyl([x, 0, z], 0, [0, 1.8, 0], 0.12, 0.12, 3.6, 'planks_dark', { seg: 8 });
    L.solid([-31.6, 0, -3], [-30, 7.5, 3], 'concrete_dark');
    L.cage({ ...entry, pos: [entry.pos[0], 4, entry.pos[2]], role: 'entry', text: 'HALDE' });
    L.spawn = { pos: L.cageToWorld({ ...entry, pos: [entry.pos[0], 4, entry.pos[2]] }, [0, 0, -0.3]), yaw: entry.rotY + PI };
    L.booth({ pos: [-23.0, 4, -2.0], rotY: -PI / 2, range: [1, 3], post: true });
    L.props.sign([-21.7, 5.2, -2.95], 0, ['HALDE · PATH TO THE CHURCH', 'HOUSES RISE AS THEY LIGHTEN'], { w: 1.8, h: 0.4, bg: '#2f4a3f' });
    // the path: five houses on chains, then the church tower
    const H = [
      { pos: [-19.0, 0, 0.0], weight: 1 },
      { pos: [-14.6, 0, 1.6], weight: -3, rotY: 0.3 },
      { pos: [-10.4, 0, -0.4], weight: 0, rotY: -0.2 },
      { pos: [-6.2, 0, 1.2], weight: -2, rotY: 0.15 },
      { pos: [-2.0, 0, 0.0], weight: -6, rotY: -0.1 },
    ];
    L.named.houses = H.map((h, i) => L.house({ ...h, base: 4, step: 2, max: 16, style: i, name: 'house of Halde' }));
    // the church tower with its belfry at 14 m
    const tx = 2.6;
    L.solid([tx - 2, 0, -2], [tx + 2, 13.4, 2], 'stone');
    L.solid([tx - 2.2, 13.4, -2.2], [tx + 2.2, 13.8, 2.2], 'stone', { bevel: 0.04 });
    for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) L.solid([tx + x - 0.3, 13.8, z - 0.3], [tx + x + 0.3, 16.6, z + 0.3], 'stone');
    L.solid([tx - 2.3, 16.6, -2.3], [tx + 2.3, 17.0, 2.3], 'stone');
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.0, 6, 4), mats.get('rooftiles_dark')); spire.position.set(tx, 20, 0); spire.rotation.y = PI / 4; L.root.add(spire);
    const bell = new THREE.Mesh(new THREE.LatheGeometry([[0, 1.1], [0.15, 1.1], [0.35, 0.95], [0.45, 0.4], [0.62, 0.05], [0.66, 0.0], [0.0, 0.0]].map(([x, y]) => new THREE.Vector2(x, y)), 32), mats.get('copper'));
    bell.position.set(tx, 14.9, 0); L.root.add(bell);
    L.named.bell = bell;
    L.props.box([tx, 16.0, 0], 0, [-1.2, -0.06, -0.06], [1.2, 0.06, 0.06], 'planks_dark');
    L.interactable({ pos: [tx, 15.4, 0], half: [0.7, 0.6, 0.7], prompt: 'Ring the bell', onUse: () => L.def.ringBell(L) });
    const varga = L.npc({ name: 'varga', pos: [tx + 1.2, 13.8, -1.2], yaw: -PI * 0.75, anim: 'Idle_Rail_Loop', spec: VARGA });
    void varga;
    // the rest of the village, hanging at all heights in the dark
    const r = rng(74);
    for (let i = 0; i < 40; i++) {
      const a = r() * PI * 2, d = 14 + r() * 34;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (x < -14 && Math.abs(z) < 8) continue;
      L.house({ pos: [x, 0, z], weight: -Math.floor(r() * 6), base: 2, step: 1.6, max: 14, style: i, rotY: r() * PI * 2 }).fixedDecor = true;
    }
    for (const [x, z] of [[-10, -12], [6, 10], [-16, 14], [18, -6]]) L.point([x, 7, z], { color: '#d8e4e6', intensity: 30, distance: 30 });
    L.point([tx, 15.5, 0], { color: '#ffd29a', intensity: 14, distance: 9 });
    L.exitCageSpot = null;
  },
  start(L) {
    const g = L.game;
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'Welcome to Halde, Auditor. Population three hundred and twelve. Mind the lake bed; it remembers everything that ever sank into it.');
      await L.say('varga', 'Come up to the church. I would like you to see it from the bell tower. Everyone should, once.', { chime: false });
      await s.until(() => g.player.pos.y > 13.0 && g.player.pos.x > 0);
      const v = L.named.varga;
      v.play('Idle_Talking_Loop');
      await L.say('varga', 'There. My mother’s house is the one with the blue shutters. You can’t see the blue in this light.', { channel: 'person' });
      await L.say('varga', 'Forty-one thousand tonnes, and it still sits on the bottom. Thirty years of my life. One more measure, Teodor says, every year. One more.', { channel: 'person' });
      v.play('Idle_No_Loop');
      await L.say('varga', 'I know what the dam is carrying. I am not a fool. I am only… not finished.', { channel: 'person' });
      v.play('Idle_FoldArms_Loop');
      await L.say('varga', 'Ring the bell, Auditor. It hasn’t rung since nineteen forty-nine. Then go down to the vault and do whatever it is auditors do.', { channel: 'person' });
    });
  },
  ringBell(L) {
    if (L.flags?.rung) return;
    (L.flags ||= {}).rung = true;
    audio.play('bell', { f: 196, gain: 1.2, pos: new THREE.Vector3(2.6, 14.9, 0) });
    L.run(async s => {
      for (let i = 0; i < 30; i++) { L.named.bell.rotation.z = Math.sin(i * 0.5) * 0.25 * (1 - i / 30); await s.wait(0.05); }
      L.named.bell.rotation.z = 0;
      await s.wait(2);
      await L.say('varga', '…Thank you.', { channel: 'person' });
      await s.wait(1);
      L.game.ui.flash('A maintenance lift waits at the foot of the tower.', 3000);
      L.named.towerLift.openGate();
      L.flags.lift = true;
    });
  },
};
// the tower has its own lift down to the vault
const _b25 = c25.build;
c25.build = function (L) {
  _b25(L);
  const spot = { pos: [2.6, 13.8, 3.75], rotY: PI };
  // a small cage hung on the tower's south face at belfry level
  L.solid([0.8, 13.6, 2.2], [4.4, 13.8, 5.5], 'stone');
  const cage = L.cage({ ...spot, role: 'exit', when: () => L.flags?.lift, text: 'THE VAULT' });
  L.named.towerLift = cage;
};

// ------------------------------------------------------------------ III·9  The Ballast Vault
const c26 = {
  id: 'c26', ledger: 'III', chamber: 9, title: 'The Ballast Vault',
  tare: { capacity: 4, debt: true },
  build(L) {
    shell(L, { min: [-12, 0, -9], max: [12, 8, 9], theme: 'service', holes: [[-2.5, -9, 4.5, 9]], mats: { wall: 'concrete_dark', floor: 'slab_dark', ceiling: 'concrete_dark' }, entry: { wall: 'x-', a: 0, text: 'THE VAULT' }, exit: { wall: 'x+', a: 0, when: () => L.flags.balanced },
      lights: [], fill: 0.8, hemi: 0.4, fillColor: '#ffd7a8' });
    L.reverb = 'vast';
    L.killY = -8; L.killYTop = 14;
    L.ambience = { room: 0.3, drone: 0.5, machine: 0.3, creaks: 0.8, knocks: 0.6, every: 1.6 };
    L.fog('#100d0b', 0.03);
    // rows of ballast ingots (the deposited weight of Halde)
    const mats = L.game.engine.materials;
    const ingot = new THREE.BoxGeometry(1.6, 0.9, 0.8);
    const im = new THREE.InstancedMesh(ingot, mats.get('rust'), 160);
    let k = 0; const m4 = new THREE.Matrix4();
    for (let x = -10.5; x <= -3.5; x += 1.75) for (const z of [-8.3, -7.4, -6.5, 6.5, 7.4, 8.3]) for (let y = 0; y < 3; y++) { if (k >= 160) break; m4.makeTranslation(x, 0.45 + y * 0.9, z); im.setMatrixAt(k++, m4); }
    for (let x = 5.5; x <= 11; x += 1.75) for (const z of [-8.3, 8.3]) for (let y = 0; y < 2; y++) { if (k >= 160) break; m4.makeTranslation(x, 0.45 + y * 0.9, z); im.setMatrixAt(k++, m4); }
    im.count = k; im.castShadow = true; im.receiveShadow = true; L.root.add(im);
    L.clip([-11.5, 0, -8.9], [-2.6, 3, -6.0]); L.clip([-11.5, 0, 6.0], [-2.6, 3, 8.9]);
    for (const x of [-2.55, 4.55]) L.props.railing([x, 0, -8.8], [x, 0, 8.8], { h: 1.0, posts: 2.2 });
    for (const x of [-7, 0, 7]) L.props.pendant([x, 8, 0], { intensity: 26, drop: 1.5, shade: 'paint_black', distance: 14, shadow: x === 0 });
    // the pit between you and the Great Balance, crossed on the ceiling
    L.solid([-2.5, -10, -9], [4.5, -9.6, 9], 'concrete_dark');
    L.named.pitHole = true;
    // the Great Balance: two pans on one beam
    const lift = L.lift({ a: [8.2, 2.0, -4.4], b: [8.2, 2.0, 4.4], size: [2.4, 2.4], range: [-1.6, 1.6], start: 1.6, ballast: [6, 2], ballastSide: [-1, -1], railsA: 'xz', railsB: 'xZ', pulleyY: 7.4, maxV: 0.5, gain: 0.4 });
    L.named.balance = lift;
    L.props.sign([8.2, 4.2, -8.97], 0, ['VAULT'], { w: 1.0, h: 0.24, style: 'plate', bg: '#b89a5a', fg: '#2a2218' });
    L.props.sign([8.2, 4.2, 8.97], PI, ['HALDE'], { w: 1.0, h: 0.24, style: 'plate', bg: '#b89a5a', fg: '#2a2218' });
    L.booth({ pos: [6.0, 8, 0], rotY: -PI / 2, range: [-2, 2], post: true, hang: true });
    L.onUpdate(() => { if (!L.flags.balanced && lift.ballast[0].weight === lift.ballast[1].weight && Math.abs(lift.v) < 0.01) { L.flags.balanced = true; L.def.release(L); } });
    // Varga at the control desk
    L.solid([-4.8, 0, 2.6], [-3.0, 0.95, 3.6], 'paint_green', { bevel: 0.02 });
    L.props.panel([-3.9, 1.45, 3.15], 0, { w: 1.4, h: 0.5 });
    L.npc({ name: 'varga', pos: [-3.9, 0, 4.3], yaw: PI, anim: 'Idle_Loop', spec: VARGA });
    L.flags = {};
    L.note({ pos: [-4.4, 0.96, 3.0], rotY: 0.2, kind: 'paper', doc: DOCS.vaultOrder });
  },
  start(L) {
    L.flags = {};
    const g = L.game;
    L.run(async s => {
      await s.wait(2.5);
      const v = L.named.varga;
      v.play('Idle_Talking_Loop');
      await L.say('varga', 'The vault. Every measure I ever drew from Halde is in this room, and in the concrete around it. It is very quiet, for so much weight.', { channel: 'person' });
      await L.say('varga', 'That is the Great Balance. One pan for the vault, one for the village. Balance them and the weight goes home. All of it. The village sinks; the dam rests.', { channel: 'person' });
      v.play('Idle_No_Loop');
      await L.say('varga', 'I cannot do it. I have tried. So I am going to make it difficult for you, and you are going to do it anyway. That is what I would want, if I were you.', { channel: 'person' });
      v.play('Interact', { loop: false });
      await s.wait(1.2);
      const drawn = Math.max(0, g.player.weight + 2);
      g.player.setWeight(-2);
      g.tare.stored = Math.min(g.tare.capacity, g.tare.stored + drawn);
      audio.play('tare', { give: false, stored: g.tare.stored });
      g.ui.flash('She draws your weight into your own instrument. You weigh −2.', 3200);
      await L.say('varga', 'There. Your weight is in your hand, where you can see it. There is a post by the Balance to put it back.', { channel: 'person' });
      v.play('Idle_FoldArms_Loop');
    });
  },
  release(L) {
    const g = L.game;
    L.run(async s => {
      await s.wait(1);
      audio.play('groan', { gain: 1.4 });
      g.shake = 2;
      await s.wait(1.5);
      audio.play('bell', { f: 196, gain: 0.7 });
      await L.say('varga', 'There it goes.', { channel: 'pa' });
      await s.wait(1.2);
      await L.say('brask', 'Readings are falling. Foundations at ninety per cent of design. Eighty. It’s holding. It’s holding, Auditor.');
      await L.say('varga', 'Come up to the crest. It’s nearly morning.', { chime: false });
    });
  },
};

export default [c18, c19, c20, c21, c22, c23, c24, c25, c26];
