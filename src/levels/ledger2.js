// LEDGER II — Closed Accounts. Brine, glass, twins, reference persons, the Hall of
// 312, the Ledger Hall, chained lifts, the flood, and the Director's office.
import * as THREE from 'three';
import { shell, chamberPlate, obsWindow, ceilingPipes, operatorDesk } from './kit.js';
import { DOCS } from './docs.js';
import { haldeCensus } from './names.js';
import { tagAtlas, flapTexture, signTexture } from '../render/signs.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/util.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ II·1  Brine
const c09 = {
  id: 'c09', ledger: 'II', chamber: 1, title: 'Below the Waterline',
  tare: { capacity: 2, debt: true },
  build(L) {
    shell(L, { min: [-10, 0, -6], max: [10, 6, 6], theme: 'wet', holes: [[-10, -1.6, 10, 1.6]], entry: { wall: 'x-', a: -3.6, text: 'LEDGER II  1' }, exit: { wall: 'x+', a: 3.6, when: () => L.named.p.pressed },
      lights: [[-6, -3.5], [0, -3.5, { shadow: true }], [6, -3.5], [-6, 3.5], [6, 3.5, { flicker: true }]], fill: 0.9 });
    L.killY = -6;
    // the channel
    L.solid([-10, -2.9, -1.6], [10, -2.5, 1.6], 'concrete_dark');
    L.solid([-10, -2.5, -2.0], [10, -0.4, -1.6], 'concrete_dark');
    L.solid([-10, -2.5, 1.6], [10, -0.4, 2.0], 'concrete_dark');
    L.brine({ min: [-10, -2.5, -1.6], max: [10, -0.35, 1.6], current: [0.85, 0] });
    for (const z of [-1.62, 1.62]) L.visual([-10, -0.06, z - (z < 0 ? 0.05 : 0)], [10, 0.02, z + (z > 0 ? 0.05 : 0)], 'paint_ochre', { grime: false });
    L.ambience = { room: 0.5, water: 0.5, drips: 0.8, creaks: 0.3, every: 2.5 };
    L.wet = 0.6;
    const p = L.plate({ pos: [6.2, 0, 4.2], need: 1, dialAt: [7.4, 0, 5.2], dialRotY: -PI * 0.8 });
    L.named.p = p;
    L.crate({ pos: [-7.2, 0, -3.6], weight: 1 });
    L.wire({ from: p, points: [[6.7, 4.2], [9.6, 4.2], [9.6, 3.6]] });
    chamberPlate(L, [-9.97, 2.1, -1.0], PI / 2, 'II', 1);
    L.props.sign([-4, 2.4, -5.97], 0, ['DANGER', 'BRINE — DO NOT ENTER'], { w: 1.2, h: 0.4, bg: '#e6dcc2', fg: '#7d2a1f' });
    L.props.pipeRun([[-10, 5.4, -5.6], [10, 5.4, -5.6]], { r: 0.09, mat: 'rust' });
    L.props.barrel([8.6, 0, -4.8], { mat: 'paint_red' });
    L.props.barrel([9.2, 0, -4.2], { mat: 'paint_blue', tipped: true });
    L.note({ pos: [-8.6, 1.5, 5.97], rotY: PI, wall: true, doc: DOCS.brineNotice });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Archive floors start here, under the waterline. The brine is cold and it doesn’t give things back.');
      await L.say('brask', 'It holds up anything lighter than about two and a half. Including you, standing on something.');
    });
  },
};

// ------------------------------------------------------------------ II·2  Glass
const c10 = {
  id: 'c10', ledger: 'II', chamber: 2, title: 'Wired Glass',
  tare: { capacity: 2, debt: true },
  build(L) {
    shell(L, { min: [-6, 0, -7], max: [6, 9, 7], theme: 'calib3', entry: { wall: 'z+', a: -2.8, y: 4.5, text: 'LEDGER II  2' }, exit: { wall: 'z-', a: 2.8, when: () => L.named.p.pressed },
      lights: [[-3, -4], [3, -4, { shadow: true }], [-3, 4], [3, 4]] });
    // upper floor with a glass panel over the scale
    for (const [a, b] of [[[-6, 4.2, -1], [-1.2, 4.5, 7]], [[1.2, 4.2, -1], [6, 4.5, 7]], [[-1.2, 4.2, -1], [1.2, 4.5, 1.4]], [[-1.2, 4.2, 3.8], [1.2, 4.5, 7]]]) L.solid(a, b, 'terrazzo', { bevel: 0.01 });
    L.glass({ min: [-1.2, 4.38, 1.4], max: [1.2, 4.5, 3.8], limit: 4 });
    L.props.railing([-5.95, 4.5, -0.95], [5.95, 4.5, -0.95], { h: 1.05, posts: 1.5 });
    for (const x of [-4, 0, 4]) L.props.cyl([x, 0, -0.85], 0, [0, 2.1, 0], 0.13, 0.13, 4.2, 'paint_black', { seg: 10 });
    const p = L.plate({ pos: [0, 0, 2.6], need: 4, dialAt: [1.4, 0, 1.6], dialRotY: PI * 0.75 });
    L.named.p = p;
    L.solid([2.8, 4.5, 4.4], [4.4, 4.75, 6], 'terrazzo_dark', { bevel: 0.02 });
    L.crate({ pos: [3.6, 4.75, 5.2], weight: 4, tag: 'REF 4' });
    L.wire({ from: p, points: [[0, 2.0], [0, -6.6], [2.0, -6.6]] });
    chamberPlate(L, [-1.5, 6.6, 6.97], PI, 'II', 2);
    L.props.sign([0, 4.9, 3.85], PI, ['INSPECTION GLASS — DO NOT STAND'], { w: 1.4, h: 0.16, bg: '#c39a3c', fg: '#1d1b19' });
    L.props.shelf([-5.75, 0, -3.5], PI / 2, { w: 2.4, h: 2.4, seed: 11 });
    L.props.cabinet([5.5, 0, -5.5], -PI / 2);
    operatorDesk(L, [-4.2, 4.5, 5.6], PI, 12);
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'Inspection glass is rated for four measures. It does not care whether those measures are a crate, or a person, or a person carrying a crate.');
    });
  },
};

// ------------------------------------------------------------------ II·3  Twins
const c11 = {
  id: 'c11', ledger: 'II', chamber: 3, title: 'Communicating Vessels',
  tare: { capacity: 2, debt: true },
  build(L) {
    shell(L, { min: [-7, 0, -6], max: [7, 5, 6], theme: 'calib2', entry: { wall: 'x-', a: -3.5, text: 'LEDGER II  3' }, exit: { wall: 'x+', a: -3.0, when: () => L.named.a.pressed && L.named.b.pressed },
      lights: [[-4, -3], [3, -3, { shadow: true }], [0, 4.5]] });
    // glass partition: the back strip is out of reach
    L.solid([-7, 0, 2.6], [7, 0.9, 3.0], 'tile_green');
    L.solid([-7, 2.9, 2.6], [7, 5, 3.0], 'plaster_cream');
    for (const x of [-7, -3.5, 0, 3.5, 6.8]) L.solid([x, 0.9, 2.6], [x + 0.2, 2.9, 3.0], 'paint_black');
    L.solid([-7, 0.9, 2.75], [7, 2.9, 2.85], 'wiredglass', { shadow: false, surface: 'metal' });
    const a = L.plate({ pos: [1.5, 0, -1.2], need: 4, exact: true, dialAt: [2.7, 0, -2.2], dialRotY: -PI * 0.8 });
    const b = L.plate({ pos: [2.0, 0, 4.6], need: 4, dialAt: [3.2, 0, 4.0], dialRotY: PI });
    L.named.a = a; L.named.b = b;
    const t1 = L.crate({ pos: [-4.6, 0, -3.8], weight: 1 });
    const t2 = L.crate({ pos: [2.0, 0, 4.6], weight: 1 });
    L.twins(t1, t2);
    L.anchor({ pos: [-5.4, 0, 0.6], weight: 6 });
    L.wire({ from: a, points: [[2.0, -1.2], [6.6, -1.2], [6.6, -3.0]] });
    L.wire({ from: b, points: [[2.6, 4.6], [6.6, 4.6], [6.6, 3.1]] });
    chamberPlate(L, [-6.97, 2.1, -0.6], PI / 2, 'II', 3);
    L.props.sign([-1.5, 2.2, 2.58], PI, ['TWINNED BALLAST', 'SHARES ITS MEASURES EQUALLY'], { w: 1.5, h: 0.36, bg: '#3f5867' });
    L.note({ pos: [-6.2, 0.9, -5.2], rotY: 0.4, kind: 'clipboard', doc: DOCS.twinsNote });
    L.solid([-6.9, 0, -5.9], [-5.6, 0.9, -4.6], 'veneer_oak', { bevel: 0.01 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Twinned ballast. Cast from the same pour, tuned to the same note. Whatever you give one, they share.');
    });
  },
};

// ------------------------------------------------------------------ II·4  Reference persons
const c12 = {
  id: 'c12', ledger: 'II', chamber: 4, title: 'Standard Persons',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-8, 0, -6], max: [8, 5, 6], theme: 'archive', entry: { wall: 'x-', a: 0, text: 'LEDGER II  4' }, exit: { wall: 'x+', a: -3.4, when: () => L.named.p.pressed },
      lights: [[-4, -3], [-4, 3], [3, 0, { shadow: true }]], fill: 1.0 });
    const p = L.plate({ pos: [4.6, 0, 1.4], need: 8, size: 2.2, dialAt: [6.4, 0, 0.0], dialRotY: -PI * 0.75 });
    L.named.p = p;
    L.refPerson({ pos: [-4.8, 0, -3.6], yaw: 0.3, weight: 4 });
    L.refPerson({ pos: [-4.2, 0, 3.8], yaw: 2.6, weight: 4, female: false });
    L.crate({ pos: [0, 1.4, -0.4], weight: 0 });
    // the rest of the reference set, standing along the walls
    for (let i = 0; i < 6; i++) L.mannequin({ pos: [-7.4 + i * 1.1, 0, 5.55], yaw: PI, pose: i % 3 ? 'stand' : 'stand2' });
    for (let i = 0; i < 4; i++) L.mannequin({ pos: [-1.5 + i * 1.1, 0, -5.55], yaw: 0, pose: i % 2 ? 'fold' : 'stand' });
    L.wire({ from: p, points: [[5.8, 1.4], [7.6, 1.4], [7.6, -2.3]] });
    chamberPlate(L, [-7.97, 3.0, 2.6], PI / 2, 'II', 4);
    L.props.sign([-1.0, 3.3, -5.97], 0, ['REFERENCE PERSONS', 'STANDARD BODY · 70 KG · FOUR MEASURES'], { w: 2.0, h: 0.4 });
    L.note({ pos: [7.97, 1.6, 3.6], rotY: -PI / 2, wall: true, doc: DOCS.refPersonSpec });
  },
  start(L) {
    L.run(async s => {
      await s.wait(2.5);
      await L.say('brask', 'Your fork’s widened again — three now. You’ll want it here.');
      L.game.ui.flash('The tare can now hold three measures.', 2600);
      await L.say('brask', 'Reference persons. Seventy kilos, four measures, every one. You can’t lift a person. You can make one weigh nothing and give them a push.');
    });
  },
};

// ------------------------------------------------------------------ II·5  The Hall of 312
const c13 = {
  id: 'c13', ledger: 'II', chamber: 5, title: 'Three Hundred and Twelve',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-5, 0, -26], max: [5, 6.5, 26], theme: 'archive', mats: { floor: 'planks_grey', wall: 'plaster_grey', dado: 'veneer_walnut' }, entry: { wall: 'z-', a: 0, text: 'LEDGER II  5' }, exit: { wall: 'z+', a: 0, when: () => L.named.p.pressed },
      lights: [], fill: 0.35, hemi: 0.25, fillColor: '#d9cbb4' });
    L.fog('#100e0c', 0.045);
    L.ambience = { room: 0.35, drone: 0.25, drips: 0.2, creaks: 0.4, every: 5 };
    L.reverb = 'hall';
    // pools of light down the aisle
    for (let z = -20; z <= 20; z += 8) L.props.pendant([0, 6.5, z], { intensity: 18, drop: 1.6, shade: 'paint_black', distance: 10 });
    const census = haldeCensus();
    const atlas = tagAtlas(census, { cols: 16 });
    const r = rng(312);
    const tagQuads = [];
    let n = 0;
    const cols = [-3.6, -2.7, -1.8, 1.8, 2.7, 3.6];
    const poses = ['stand', 'stand2', 'stand', 'fold', 'stand2', 'stand', 'phone'];
    for (let z = -22.5; z <= 21 && n < census.length; z += 0.85) {
      for (const x of cols) {
        if (n >= census.length) break;
        const c = census[n];
        if (c.agnes) { n++; continue; }
        const scale = c.child ? 0.55 + c.kg / 120 : 0.94 + (c.kg - 70) / 400;
        const yaw = (x < 0 ? PI / 2 : -PI / 2) + (r() - 0.5) * 0.3;
        L.mannequin({ pos: [x, 0, z], yaw, pose: c.child ? 'stand' : r.pick(poses), lod: true, collide: false, shadow: false, scale });
        tagQuads.push({ i: n, pos: [x + Math.sin(yaw) * 0.17 * scale, 1.22 * scale, z + Math.cos(yaw) * 0.17 * scale], yaw });
        n++;
      }
    }
    L.clip([-4.9, 0, -23], [-1.4, 3, 22]); L.clip([1.4, 0, -23], [4.9, 3, 22]);
    // name tags: one merged mesh using the census atlas
    const pos = [], uv = [], idx = [];
    const tw = 0.13, th = 0.045;
    for (const q of tagQuads) {
      const cx = q.i % atlas.cols, cy = Math.floor(q.i / atlas.cols);
      const u0 = cx / atlas.cols, u1 = (cx + 1) / atlas.cols, v1 = 1 - cy / atlas.rows, v0 = 1 - (cy + 1) / atlas.rows;
      const right = V(Math.cos(q.yaw), 0, -Math.sin(q.yaw));
      const base = pos.length / 3;
      for (const [sx, sy, u, v] of [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]]) {
        pos.push(q.pos[0] + right.x * sx * tw / 2, q.pos[1] + sy * th / 2, q.pos[2] + right.z * sx * tw / 2);
        uv.push(u, v);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const tags = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.9, side: THREE.DoubleSide }));
    L.root.add(tags);
    // the dais at the far end: the photograph, the scale, Agnes kept apart by the window
    L.solid([-3, 0, 22.5], [3, 0.3, 26], 'veneer_walnut', { bevel: 0.02 });
    L.props.stairs([0, 0, 21.9], 0, { width: 2, rise: 0.15, run: 0.3, steps: 2, rails: false, mat: 'veneer_walnut', nosing: 'brass' });
    const p = L.plate({ pos: [0, 0.3, 24.0], need: 3, exact: true, dialAt: [1.4, 0.3, 24.6], dialRotY: -PI * 0.85 });
    L.named.p = p;
    L.note({ pos: [-1.8, 1.9, 25.97], rotY: PI, kind: 'photo', wall: true, doc: DOCS.photoHalde });
    L.props.pendant([0, 6.5, 24.2], { intensity: 30, drop: 2.0, shade: 'brass', shadow: true, distance: 9 });
    const agnes = L.refPerson({ pos: [-4.1, 0, 23.6], yaw: PI / 2, weight: 3, female: true, name: 'Agnes Varga' });
    L.named.agnes = agnes;
    L.clip([-4.9, 0, 22.2], [-3.1, 3, 22.4]);
    L.note({ pos: [2.6, 0.31, 23.0], rotY: -0.4, kind: 'paper', doc: DOCS.census });
    chamberPlate(L, [1.6, 2.1, -25.97], 0, 'II', 5);
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', '…These are the reference persons. Standard bodies, for calibrating the big scales. That’s what it says in the inventory.');
      await s.wait(2);
      await L.say('brask', 'Read the tags.');
      await s.until(() => L.game.player.pos.z > 12);
      await L.say('brask', 'Three hundred and twelve. Everybody who lived in Halde when they let the water in. She had one made for each of them. To the kilo.');
      await s.until(() => L.game.player.pos.z > 20);
      await L.say('brask', 'The lift at the end only answers to one weight. Her mother’s. She keeps her apart, by the window.');
    });
  },
};

// ------------------------------------------------------------------ II·6  Ledger Hall
const c14 = {
  id: 'c14', ledger: 'II', chamber: 6, title: 'The Ledger Hall',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-9, 0, -8], max: [9, 8, 8], theme: 'archive', mats: { floor: 'planks_oak', wall: 'plaster_cream', dado: 'veneer_oak' }, entry: { wall: 'z-', a: -5, text: 'LEDGER II  6' }, exit: { wall: 'x+', a: -4.5, when: () => L.flags.balanced },
      lights: [], fill: 0.9 });
    for (let x = -6; x <= 6; x += 4) for (const z of [-3.2, 0.2]) { L.props.pendant([x, 8, z], { intensity: 16, drop: 2.6, shade: 'paint_green', distance: 9 }); }
    // clerks' desks
    for (let x = -6.5; x <= 6.5; x += 3.2) for (const z of [-4.6, -1.4]) { L.props.desk([x, 0, z], 0, { seed: Math.round((x + 10) * 7 + z * 3), lamp: false }); L.props.chair([x + 0.2, 0, z + 0.75], PI + 0.2); }
    // the counter with three account scales
    L.solid([-8, 0, 3.6], [8, 0.95, 4.6], 'veneer_walnut', { surface: 'wood' });
    L.solid([-8.1, 0.95, 3.5], [8.1, 1.0, 4.7], 'veneer_oak', { bevel: 0.01 });
    const plates = [[-4.5, 2, 4], [0, 5, 1], [4.5, 1, 3]];
    const ps = plates.map(([x, need], i) => L.plate({ pos: [x, 1.0, 4.1], need, exact: true, size: 0.9, dialAt: [x + 1.1, 1.0, 4.35], dialRotY: PI, name: 'acc' + i }));
    plates.forEach(([x, , w]) => L.crate({ pos: [x, 1.04, 4.1], weight: w }));
    L.onUpdate(() => { if (!L.flags.balanced && ps.every(p => p.pressed)) { L.flags.balanced = true; L.def.reveal(L); } });
    // the great board
    const board = new THREE.Group();
    L.root.add(board);
    L.named.boardLines = [];
    const lines = ['ACC 1  STOCK      1204', 'ACC 2  CALIB       318', 'ACC 3  LOANS        96', 'ACC 7  -----   -------', 'BALANCE        CORRECT'];
    lines.forEach((t, i) => {
      const tex = flapTexture(t, { w: 1024, h: 96, cells: 22 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 0.9), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.6 }));
      m.position.set(0, 6.6 - i * 1.0, 7.86); m.rotation.y = PI;
      board.add(m);
      L.named.boardLines.push(m);
    });
    L.visual([-5, 1.6, 7.9], [5, 7.2, 8], 'paint_black', { grime: false });
    L.note({ pos: [-6.4, 0.77, -4.5], rotY: 0.3, kind: 'paper', doc: DOCS.haldeLetter });
    L.note({ pos: [6.6, 0.77, -1.3], rotY: -0.2, kind: 'paper', doc: DOCS.ledgerPage });
    chamberPlate(L, [-3.0, 2.1, -7.97], 0, 'II', 6);
    L.flags = {};
  },
  start(L) {
    L.flags = {};
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'The Ledger Hall. Every measure the Institute holds is written on that board. You will find it balances. It always balances.');
      await s.wait(1);
      await L.say('brask', 'Three of the account scales are out. Put them right and see what the board says when it isn’t being asked nicely.', { channel: 'intercom' });
    });
  },
  reveal(L) {
    const lines = ['ACC 1  STOCK      1204', 'ACC 2  CALIB       318', 'ACC 3  LOANS        96', 'ACC 7  HALDE    41212 T', 'HELD IN  KALDEN DAM'];
    L.run(async s => {
      for (let i = 0; i < lines.length; i++) {
        await s.wait(0.5);
        const m = L.named.boardLines[i];
        const tex = flapTexture(lines[i], { w: 1024, h: 96, cells: 22 });
        m.material.map = tex; m.material.emissiveMap = tex; m.material.needsUpdate = true;
        audio.play('flap', { count: 22 });
      }
      await s.wait(1.5);
      await L.say('brask', 'Account seven. Halde. Forty-one thousand, two hundred and twelve tonnes. Held in the dam.');
      await L.say('varga', 'That account is closed, Auditor. It is not part of your audit.', { chime: false });
      await L.say('brask', 'Every account is part of an audit. That’s what the word means.');
    });
  },
};

// ------------------------------------------------------------------ II·7  Pulleys
const c15 = {
  id: 'c15', ledger: 'II', chamber: 7, title: 'Atrium',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-8, 0, -8], max: [8, 13.5, 8], theme: 'service', entry: { wall: 'x-', a: -5, text: 'LEDGER II  7' }, exit: { wall: 'x-', a: -5.5, y: 9.0, when: true },
      lights: [[-4, -4, { shadow: true }], [4, -4], [-4, 4], [4, 4]], fill: 1.3 });
    // mezzanine (north) and top gallery (west)
    L.solid([-8, 4.2, 3.0], [8, 4.5, 8], 'grating', { surface: 'metal' });
    L.props.railing([-7.9, 4.5, 3.05], [-5.15, 4.5, 3.05], { h: 1.0 });
    L.props.railing([-2.85, 4.5, 3.05], [7.9, 4.5, 3.05], { h: 1.0 });
    L.solid([-8, 8.7, -8], [-3.0, 9.0, -1.0], 'grating', { surface: 'metal' });
    L.props.railing([-3.05, 9.0, -7.9], [-3.05, 9.0, -1.05], { h: 1.0 });
    for (const [x, z] of [[-6, 3.2], [0, 3.2], [6, 3.2]]) L.props.cyl([x, 0, z], 0, [0, 2.1, 0], 0.13, 0.13, 4.2, 'paint_black', { seg: 10 });
    for (const [x, z] of [[-3.2, -7.8], [-3.2, -1.2]]) L.props.cyl([x, 0, z], 0, [0, 4.35, 0], 0.13, 0.13, 8.7, 'paint_black', { seg: 10 });
    // lift 1: ground to mezzanine, with ballast
    L.lift({ a: [-4, 0, 1.9], b: [4.2, 4.5, -3.5], size: [2.1, 2.1], range: [-4.5, 0], ballast: [3, 1], railsA: 'xz', railsB: 'xzZ', pulleyY: 12.6 });
    // lift 2: mezzanine to top gallery, no ballast at all
    L.lift({ a: [-4.2, 4.5, 5.6], b: [5.0, 9.0, 5.6], size: [2.1, 2.1], range: [-4.5, 0], railsA: 'xZ', railsB: 'xzZ', pulleyY: 13.0, roof: [true, false] });
    L.solid([-5.4, 9.0 - 0.3, -1.0], [-3.0, 9.0, 4.4], 'grating', { surface: 'metal' });
    L.props.railing([-3.05, 9.0, -1.0], [-3.05, 9.0, 4.4], { h: 1.0 });
    L.crate({ pos: [1.2, 4.5, 6.4], weight: 0 });
    chamberPlate(L, [-7.97, 2.1, -2.6], PI / 2, 'II', 7);
    L.props.sign([-4.2, 7.0, 7.95], PI, ['NO BALLAST FITTED'], { w: 1.2, h: 0.18, bg: '#c39a3c', fg: '#1d1b19' });
    L.props.pipeRun([[7.6, 0, -7.6], [7.6, 13, -7.6]], { r: 0.12, mat: 'paint_green' });
    L.props.pipeRun([[7.3, 0, -7.6], [7.3, 13, -7.6]], { r: 0.07, mat: 'paint_red' });
    L.note({ pos: [6.0, 4.51, 7.2], rotY: 0.6, kind: 'clipboard', doc: DOCS.liftLog });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Two lifts. The upper one lost its ballast years ago. We used to ride it with a bag of sand.');
      await L.say('brask', 'You haven’t got sand. You’ve got something better.');
    });
  },
};

// ------------------------------------------------------------------ II·8  Flood
const c16 = {
  id: 'c16', ledger: 'II', chamber: 8, title: 'The Dam Speaks',
  tare: { capacity: 3, debt: true },
  build(L) {
    shell(L, { min: [-9, 0, -7], max: [9, 7, 7], theme: 'wet', holes: [[-5, -7, 5, 7]], entry: { wall: 'x-', a: 0, text: 'LEDGER II  8' }, exit: { wall: 'x+', a: 0, when: () => L.named.p.pressed },
      lights: [[-7, -4], [-7, 4], [0, 0, { shadow: true, flicker: true }], [7, -4], [7, 4]], fill: 0.9 });
    L.killY = -6;
    L.solid([-5, -2.4, -7], [5, -2.0, 7], 'concrete_dark');
    L.solid([-5.4, -2.0, -7], [-5, 0, 7], 'concrete_dark');
    L.solid([5, -2.0, -7], [5.4, 0, 7], 'concrete_dark');
    const br = L.brine({ min: [-5, -2.0, -7], max: [5, -2.0, 7], current: [0.55, 0] });
    br.setLevel(-2.0);
    L.named.brine = br;
    for (const x of [-5.02, 5.02]) L.visual([x - 0.04, -0.05, -7], [x + 0.04, 0.02, 7], 'paint_ochre', { grime: false });
    L.ambience = { room: 0.5, water: 0.4, drips: 1, creaks: 0.5, knocks: 0.4, every: 2 };
    const p = L.plate({ pos: [7.0, 0, -3.5], need: 1, dialAt: [8.2, 0, -4.6], dialRotY: -PI * 0.75 });
    L.named.p = p;
    L.crate({ pos: [-7.2, 0, 3.2], weight: 0 });
    L.crate({ pos: [-7.4, 0, -3.6], weight: 1, rotY: 0.3 });
    L.wire({ from: p, points: [[7.6, -3.5], [8.6, -3.5], [8.6, -1.2]] });
    chamberPlate(L, [-8.97, 2.1, 1.8], PI / 2, 'II', 8);
    L.props.pipeRun([[-9, 6.3, -6.6], [9, 6.3, -6.6]], { r: 0.12, mat: 'rust' });
    L.named.leaks = [];
    L.trigger({ min: [-9, -1, -7], max: [-7.4, 3, 7], once: true, onEnter: () => {} });
  },
  start(L) {
    L.run(async s => {
      await s.wait(2.5);
      await L.say('brask', 'Hear that? Every time she draws from the village, the dam takes up the weight. It talks about it.');
      await s.wait(1.2);
      audio.play('groan', { gain: 1.2 });
      L.game.shake = 1.6;
      for (const l of L.lights) if (l.isPointLight || l.isSpotLight) { const b = l.intensity; l.intensity = b * 0.15; setTimeout(() => { l.intensity = b; }, 900 + Math.random() * 500); }
      await s.wait(1.5);
      const water = audio.loop('water', { gain: 0.9 });
      for (let i = 0; i <= 80; i++) { L.named.brine.setLevel(-2.0 + (1.65 * i) / 80); await s.wait(0.1); }
      water?.set(0.35, 1.5);
      await L.say('brask', 'That’s the drainage gone. Brine to the floor of the pit. Don’t go swimming.');
      await L.say('brask', 'If you need it to carry more, it has to weigh less than nothing.');
    });
  },
};

// ------------------------------------------------------------------ II·9  The Director's office
const c17 = {
  id: 'c17', ledger: 'II', chamber: 9, title: 'The Director’s Office',
  tare: { capacity: 3, debt: true },
  playerWeight: 2,
  build(L) {
    shell(L, { min: [-7, 0, -6], max: [7, 4.6, 6], theme: 'archive', mats: { floor: 'planks_oak', wall: 'plaster_cream', dado: 'veneer_walnut' }, dadoH: 1.4, entry: { wall: 'z-', a: -4, text: 'LEDGER II  9' }, exit: { wall: 'x+', a: 3.2, when: () => L.flags.permit },
      lights: [], fill: 1.5, fillColor: '#ffd9a8' });
    L.props.fluoro([4.0, 4.58, -2.0], { len: 1.2, intensity: 28, color: '#ffe8c8' });
    L.props.pendant([0, 4.6, 0], { intensity: 26, drop: 1.0, shade: 'brass', shadow: true });
    L.props.pendant([-4, 4.6, 3], { intensity: 12, drop: 1.0, shade: 'paint_green' });
    // the desk, the bookcases, the model of Halde under glass
    L.props.desk([0, 0, 3.6], PI, { w: 2.0, d: 0.9, seed: 31 });
    L.props.chair([0, 0, 4.5], 0.1);
    L.props.shelf([-6.75, 0, -1.0], PI / 2, { w: 3.2, h: 2.6, seed: 32 });
    L.props.shelf([-3.5, 0, 5.75], PI, { w: 2.4, h: 2.6, seed: 33 });
    L.props.radiator([3.0, 0, 5.85], PI);
    L.props.clock([4.5, 3.2, 5.95], PI, { time: [4, 12] });
    L.props.weightSet([-0.7, 0.76, 3.4], PI);
    L.props.balanceScale([0.7, 0.76, 3.5], PI);
    // Halde in miniature
    L.solid([-1.8, 0, -1.6], [1.8, 0.85, 0.2], 'veneer_walnut', { surface: 'wood', bevel: 0.01 });
    const model = new THREE.Group(); model.position.set(0, 0.86, -0.7); L.root.add(model);
    const r = rng(1949);
    const houseMat = L.mat('render_white'), roofMat = L.mat('rooftiles');
    for (let i = 0; i < 26; i++) {
      const hx = (r() - 0.5) * 3.0, hz = (r() - 0.5) * 1.4, s = 0.07 + r() * 0.06;
      const h = new THREE.Mesh(new THREE.BoxGeometry(s * 1.4, s, s), houseMat); h.position.set(hx, s / 2, hz); h.rotation.y = r() * PI; model.add(h);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(s * 0.95, s * 0.6, 4), roofMat); rf.position.set(hx, s + s * 0.3, hz); rf.rotation.y = h.rotation.y + PI / 4; rf.scale.set(1.2, 1, 0.8); model.add(rf);
    }
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), houseMat); tower.position.set(0.3, 0.21, 0.1); model.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), roofMat); spire.position.set(0.3, 0.53, 0.1); spire.rotation.y = PI / 4; model.add(spire);
    const glassCase = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 1.7), L.game.engine.materials.glass({ opacity: 0.1 })); glassCase.position.set(0, 1.25, -0.7); L.root.add(glassCase);
    // reel-to-reel recorder on a side table: her private recordings
    L.solid([4.4, 0, -5.6], [6.4, 0.8, -4.6], 'veneer_oak', { surface: 'wood' });
    L.props.box([5.4, 0.8, -5.1], 0, [-0.35, 0, -0.22], [0.35, 0.22, 0.22], 'paint_grey', { bevel: 0.02 });
    for (const x of [5.2, 5.6]) L.props.cyl([x, 0.8, -5.1], 0, [0, 0.235, 0], 0.11, 0.11, 0.015, 'steel_dark', { seg: 20 });
    L.interactable({ pos: [5.4, 1.0, -5.1], half: [0.4, 0.15, 0.3], prompt: 'Play the reel', onUse: () => L.def.playTapes(L) });
    L.note({ pos: [-0.5, 0.775, 3.4], rotY: PI + 0.2, kind: 'photo', doc: DOCS.photoAgnes });
    L.note({ pos: [0.5, 0.775, 3.2], rotY: PI - 0.3, kind: 'paper', doc: DOCS.agnesLetter });
    L.note({ pos: [-6.97, 1.7, 3.5], rotY: PI / 2, wall: true, doc: DOCS.vargaDiary });
    chamberPlate(L, [-1.6, 2.1, -5.97], 0, 'II', 9);
    // Brask, in person
    const brask = L.npc({ name: 'brask', pos: [6.0, 0, 1.2], yaw: -PI / 2, anim: 'Idle_Loop', spec: { name: 'Brask', body: 'm', skin: 'light', outfit: 'brask', hair: 'parted', beard: true, hairColor: '#aaa49a', grey: 0.85, belly: 0.05, posture: 0.08, age: 1 } });
    void brask;
    L.flags = {};
  },
  start(L) {
    L.flags = {};
    const g = L.game;
    L.run(async s => {
      await s.until(() => g.player.pos.z > -3);
      const b = L.named.brask;
      b.play('Idle_Talking_Loop');
      await L.say('brask', 'You found it, then. Account seven.', { channel: 'person' });
      await L.say('brask', 'Forty-one thousand tonnes. Every house, every stone she could get a fork into. She’s been lifting Halde off the bottom of the lake, a measure at a time, for twenty-seven years.', { channel: 'person' });
      await L.say('brask', 'And it has to go somewhere. It always has to go somewhere. So she put it in the dam.', { channel: 'person' });
      b.play('Idle_No_Loop');
      await L.say('brask', 'The dam was built to hold back water, Auditor. Not a village.', { channel: 'person' });
      b.play('Idle_Talking_Loop');
      await L.say('brask', 'My daughter lives in Nedre Kalden. Right under it.', { channel: 'person' });
      await s.wait(0.8);
      await L.say('brask', 'Below here it’s all hers — the turbine halls, the vault, the Bell. You’ll need to be lighter than you are. Heavier. Some of the time, less than nothing.', { channel: 'person' });
      b.play('Interact', { loop: false });
      await s.wait(1.2);
      L.flags.permit = true;
      g.ui.flash('Self-tare permit issued: booths will now weigh you.', 3200);
      b.play('Idle_FoldArms_Loop');
      await L.say('brask', 'That’s a permit for the booths. Step in one and the fork will take from you as easy as from a crate.', { channel: 'person' });
      await L.say('varga', 'Teodor. Step away from my desk.');
      b.play('Idle_Loop');
      await L.say('brask', 'Go on. The private lift’s open. I’ll keep her talking.', { channel: 'person' });
      b.walkTo([[3.0, 0, -2.0], [-3.8, 0, -4.6]], { speed: 1.1 });
    });
  },
  playTapes(L) {
    if (L.flags.tapes) return;
    L.flags.tapes = true;
    L.run(async () => {
      await L.say('reel', 'Kalden, March. I have drawn the schoolhouse today. Eleven measures. The roof beams were the hardest; wet wood holds on.', { channel: 'reel' });
      await L.say('reel', 'Teodor says the inspectors from the Ministry will ask questions about the dam. Let them ask. The dam was always going to carry something.', { channel: 'reel' });
      await L.say('reel', 'When the village is light enough it will simply rise, Mama. Like you said the cork floats. Like you said everything good comes back up.', { channel: 'reel' });
    });
  },
};

export default [c09, c10, c11, c12, c13, c14, c15, c16, c17];
