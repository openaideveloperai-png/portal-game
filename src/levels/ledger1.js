// LEDGER I — Familiarisation. Eight calibration rooms that teach the instrument.
import { shell, chamberPlate, obsWindow, ceilingPipes, operatorDesk } from './kit.js';
import { DOCS } from './docs.js';

const PI = Math.PI;

// ------------------------------------------------------------------ I·1  Draw
const c01 = {
  id: 'c01', ledger: 'I', chamber: 1, title: 'A Measure Drawn',
  tare: { capacity: 1 },
  build(L) {
    const S = shell(L, { min: [-6, 0, -7], max: [6, 5, 7], theme: 'calib', entry: { wall: 'z-', a: 0, text: 'LEDGER I  1' }, exit: { wall: 'z+', a: -2.6, when: () => L.named.p.pressed },
      lights: [[-2.5, -3], [2.5, -3], [-2.5, 3, { shadow: true }], [2.5, 3]] });
    void S;
    const p = L.plate({ pos: [2.2, 0, 2.2], need: 2, dialAt: [3.3, 0, 1.3], dialRotY: -PI * 0.75 });
    L.named.p = p;
    L.crate({ pos: [2.2, 0, 2.2], weight: 1 });
    // the ledge with the second crate, out of reach
    L.solid([3.9, 2.7, -3.2], [6, 3.0, 0.2], 'concrete', { bevel: 0.02 });
    for (const z of [-3.0, 0.0]) L.props.box([5.95, 2.7, z], 0, [-1.1, -0.06, -0.04], [0, 0, 0.04], 'paint_black');
    L.crate({ pos: [5.0, 3.0, -1.5], weight: 1, rotY: 0.2 });
    L.wire({ from: p, points: [[2.2, 2.8], [2.2, 6.6], [-1.3, 6.6]] });
    chamberPlate(L, [1.7, 2.1, -6.97], 0, 'I', 1);
    L.props.radiator([-3.5, 0, -6.95], 0);
    L.props.clock([-5.97, 3.4, 0], PI / 2, { time: [10, 12] });
    L.props.poster([-5.97, 2.0, 3.2], PI / 2, 'measure');
    ceilingPipes(L, [-5.6, -7], [-5.6, 7], { y: 5 });
    obsWindow(L, [-5.98, 3.6, -3.5], PI / 2, { w: 2.0, h: 0.9 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3.5);
      await L.say('brask', 'First room. The scale wants two. The crate on it holds one, and there’s another up on that ledge.');
      await L.say('brask', 'You don’t need to reach it. You only need to see it.');
      await s.until(() => L.weighted[1]?.weight === 0, 0.2);
      await s.wait(0.8);
      await L.say('brask', 'See how it hangs there? Nothing left to pull it down.');
    });
  },
};

// ------------------------------------------------------------------ I·2  Carried
const c02 = {
  id: 'c02', ledger: 'I', chamber: 2, title: 'Carried Forward',
  tare: { capacity: 1 },
  build(L) {
    shell(L, { min: [-6.5, 0, -6], max: [6.5, 4.6, 6], theme: 'calib2', entry: { wall: 'x-', a: -2.5, text: 'LEDGER I  2' }, exit: { wall: 'x+', a: 3.0, when: () => L.named.p1.pressed && L.named.p2.pressed },
      lights: [[-3, -2.5], [3, -2.5, { shadow: true }], [-3, 2.5], [3, 2.5]] });
    const p1 = L.plate({ pos: [-1.5, 0, 3.2], need: 2, dialAt: [-0.4, 0, 4.4], dialRotY: PI * 0.8 });
    const p2 = L.plate({ pos: [2.6, 0, 3.2], need: 3, dialAt: [3.7, 0, 4.4], dialRotY: PI * 0.8 });
    L.named.p1 = p1; L.named.p2 = p2;
    L.crate({ pos: [-3.5, 0, -3.6], weight: 2 });
    L.crate({ pos: [4.6, 0, -4.2], weight: 1, rotY: 0.4 });
    L.anchor({ pos: [-4.6, 0, 1.2], weight: 2 });
    L.wire({ from: p1, points: [[-1.5, 3.8], [-1.5, 5.6], [6.1, 5.6], [6.1, 4.3]] });
    L.wire({ from: p2, points: [[3.2, 3.2], [5.6, 3.2], [5.6, 4.2]] });
    chamberPlate(L, [-6.47, 2.1, 0.2], PI / 2, 'I', 2);
    operatorDesk(L, [-4.6, 0, -5.2], 0, 4);
    L.props.cabinet([0.5, 0, -5.6], 0);
    L.props.cabinet([1.1, 0, -5.6], 0, { drawers: 3 });
    L.props.poster([6.47, 2.0, -2.5], -PI / 2, 'quiet');
    ceilingPipes(L, [-6.5, 5.4], [6.5, 5.4], { y: 4.6 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Two scales this time. Lift what you can with E. Anything you’re holding counts as you, while you hold it.');
      L.game.ui.hint('<kbd>E</kbd> lift or set down · only things of two measures or less can be lifted', 7000);
    });
  },
};

// ------------------------------------------------------------------ I·3  Bank
const c03 = {
  id: 'c03', ledger: 'I', chamber: 3, title: 'On Deposit',
  tare: { capacity: 1 },
  build(L) {
    shell(L, { min: [-7, 0, -5], max: [7, 5, 5], theme: 'calib', entry: { wall: 'x-', a: 0, text: 'LEDGER I  3' }, exit: { wall: 'z+', a: 4.6, when: () => L.named.p.pressed },
      lights: [[-4, 0], [0, 0, { shadow: true }], [4, 0]] });
    // the weighing dais (crates must be lifted onto it, not pushed)
    L.solid([3.4, 0, -1.8], [6.99, 0.55, 1.8], 'terrazzo_dark', { bevel: 0.02 });
    L.props.stairs([2.5, 0, 0], PI / 2, { width: 1.2, rise: 0.183, run: 0.3, steps: 3, rails: false });
    const p = L.plate({ pos: [5.3, 0.55, 0], need: 4, dialAt: [6.5, 0.55, -1.2], dialRotY: -PI * 0.75 });
    L.named.p = p;
    L.crate({ pos: [-4.2, 0, 1.6], weight: 4, tag: 'REF 4' });
    L.crate({ pos: [-0.5, 1.7, -2.6], weight: 0 });
    L.wire({ from: p, points: [[5.3, 0.6, 1.0], [5.3, 0.6, 1.8], [5.3, 0, 1.85], [5.3, 0, 4.4]] });
    chamberPlate(L, [-6.97, 3.0, 2.2], PI / 2, 'I', 3);
    L.props.shelf([-1.2, 0, 4.75], PI, { w: 2.6, h: 2.2, seed: 5 });
    L.props.radiator([1.5, 0, -4.95], 0);
    L.props.poster([3.2, 2.4, -4.97], 0, 'measure', { seed: 4 });
    obsWindow(L, [0, 3.7, -4.98], 0, { w: 2.6 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'Calibration room three. The reference crate weighs four. You cannot lift four. Nobody can lift four.');
      await L.say('varga', 'Measures can be put down somewhere for safekeeping. That is, after all, what a bank is for.', { chime: false });
    });
  },
};

// ------------------------------------------------------------------ I·4  Imponderable
const c04 = {
  id: 'c04', ledger: 'I', chamber: 4, title: 'Imponderable',
  tare: { capacity: 1 },
  build(L) {
    const holes = [[-2.5, -6, 2.5, 6]];
    shell(L, { min: [-8, 0, -6], max: [8, 5.5, 6], theme: 'calib3', holes, entry: { wall: 'x-', a: -2, text: 'LEDGER I  4' }, exit: { wall: 'x+', a: 2.5, when: () => L.named.p.pressed },
      lights: [[-5, 0], [0, -3, { shadow: true }], [0, 3], [5, 0]] });
    L.killY = -7;
    // the pit: walls down and a dark floor far below
    L.solid([-2.5, -8, -6], [2.5, -7.6, 6], 'concrete_dark');
    L.solid([-2.9, -7.6, -6], [-2.5, 0, 6], 'concrete_dark');
    L.solid([2.5, -7.6, -6], [2.9, 0, 6], 'concrete_dark');
    for (const x of [-2.6, 2.6]) L.props.railing([x, 0, -5.9], [x, 0, 3.9], { h: 0.9, posts: 1.6, collide: false });
    // personnel catwalk on the far side (no ballast)
    L.solid([-2.6, -0.06, 4.6], [2.6, 0, 5.9], 'grating', { surface: 'metal' });
    L.props.railing([-2.5, 0, 4.55], [2.5, 0, 4.55], { h: 1.0, posts: 1.25 });
    for (const x of [-2.9, 2.9]) {
      L.clip([x - 0.1, 0, 4.4], [x + 0.1, 3, 6], { player: false, crates: true });
      L.props.sign([x + (x < 0 ? -0.4 : 0.4), 2.2, 5.97], PI, ['PERSONNEL ONLY', 'NO BALLAST'], { w: 0.6, h: 0.3, bg: '#e6dcc2', fg: '#7d2a1f' });
    }
    const p = L.plate({ pos: [5.6, 0, -2.6], need: 1, dialAt: [6.8, 0, -3.6], dialRotY: -PI * 0.7 });
    L.named.p = p;
    L.crate({ pos: [-5, 0, -0.5], weight: 1 });
    L.wire({ from: p, points: [[6.1, -2.6], [7.6, -2.6], [7.6, 1.2]] });
    chamberPlate(L, [-7.97, 2.1, 0.4], PI / 2, 'I', 4);
    L.props.poster([-7.97, 2.0, 3.5], PI / 2, 'debt');
    ceilingPipes(L, [-8, 5.4], [8, 5.4], { y: 5.5 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Mind the pit. Things with no weight don’t fall — they just wait where you leave them.');
      await L.say('brask', 'And a good shove sends one a long way.');
      L.game.ui.hint('<kbd>Q</kbd> shove · while holding something, <kbd>Q</kbd> throws it', 7000);
    });
  },
};

// ------------------------------------------------------------------ I·5  Exact
const c05 = {
  id: 'c05', ledger: 'I', chamber: 5, title: 'Exact Change',
  tare: { capacity: 1 },
  build(L) {
    shell(L, { min: [-6, 0, -6], max: [6, 4.8, 6], theme: 'calib2', entry: { wall: 'z-', a: -2, text: 'LEDGER I  5' }, exit: { wall: 'z+', a: 2.4, when: () => L.named.e1.pressed && L.named.e2.pressed },
      lights: [[-2.5, -2.5], [2.5, -2.5], [0, 2.5, { shadow: true }]] });
    const e1 = L.plate({ pos: [-2.8, 0, 2.0], need: 4, exact: true, dialAt: [-1.7, 0, 3.0], dialRotY: PI * 0.8 });
    const e2 = L.plate({ pos: [2.4, 0, -0.6], need: 4, exact: true, dialAt: [3.6, 0, 0.3], dialRotY: PI * 0.8 });
    L.named.e1 = e1; L.named.e2 = e2;
    L.crate({ pos: [-2.8, 0, 2.0], weight: 5, tag: 'REF 5' });
    L.crate({ pos: [4.4, 0, -3.8], weight: 1 });
    L.crate({ pos: [0.6, 0, -3.6], weight: 2, rotY: 0.5 });
    L.wire({ from: e1, points: [[-2.8, 2.6], [-2.8, 5.6], [1.3, 5.6]] });
    L.wire({ from: e2, points: [[2.4, 0.0], [2.4, 5.4]] });
    chamberPlate(L, [-3.6, 2.1, -5.97], 0, 'I', 5);
    L.props.sign([-5.97, 2.6, 0], PI / 2, ['CALIBRATED SCALES', 'EXACT LOAD ONLY'], { w: 1.1, h: 0.36 });
    operatorDesk(L, [4.6, 0, 4.6], PI, 6);
    L.props.shelf([-5.75, 0, -2.6], PI / 2, { w: 2.0, h: 2.0, seed: 8 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'These scales are calibrated. They accept four measures exactly. Not five. Not “about four”.');
      await L.say('varga', 'Most of the trouble in the world comes from people who think more is the same as enough.', { chime: false });
      await s.until(() => L.named.e1.pressed && L.named.e2.pressed);
      await s.wait(1);
      await L.say('brask', 'Hold still a moment. I’m widening your fork from up here — you’ll carry two now.');
      L.game.tare.setCapacity(2);
      L.game.ui.flash('The tare can now hold two measures.', 2600);
    });
  },
};

// ------------------------------------------------------------------ I·6  Counterweight
const c06 = {
  id: 'c06', ledger: 'I', chamber: 6, title: 'Counterweight',
  tare: { capacity: 2 },
  build(L) {
    shell(L, { min: [-6, 0, -7], max: [6, 8.5, 7], theme: 'calib', entry: { wall: 'z-', a: 2.5, text: 'LEDGER I  6' }, exit: { wall: 'z+', a: 2.5, y: 4.5, when: true },
      lights: [[-3, -3], [3, -3], [-3, 3, { shadow: true }], [3, 3]] });
    // gallery along the far wall
    L.solid([-6, 4.2, 4.5], [6, 4.5, 7], 'terrazzo_dark', { bevel: 0.02 });
    L.props.railing([-5.9, 4.5, 4.55], [-3.15, 4.5, 4.55], { h: 1.0 });
    L.props.railing([-0.85, 4.5, 4.55], [5.9, 4.5, 4.55], { h: 1.0 });
    for (const x of [-4, 0, 4]) L.props.cyl([x, 0, 4.6], 0, [0, 2.1, 0], 0.12, 0.12, 4.2, 'paint_black', { seg: 10 });
    const lift = L.lift({ a: [-2, 0, 3.35], b: [3.0, 4.5, -2.0], size: [2.1, 2.1], range: [-4.5, 0], start: 0, ballast: [2, 2], railsA: 'xz', railsB: 'xzZ', pulleyY: 7.8 });
    L.named.lift = lift;
    chamberPlate(L, [0.3, 2.1, -6.97], 0, 'I', 6);
    L.props.radiator([-3.5, 0, -6.95], 0);
    L.props.poster([5.97, 2.2, -3.8], -PI / 2, 'dam', { seed: 3 });
    obsWindow(L, [-5.98, 6.0, 0], PI / 2, { w: 2.4 });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Counterweight lift. Two cages, one rope. Whichever side is heavier goes down. That’s all a lift ever was.');
      await L.say('brask', 'The iron in each cage is ballast. It’s weight like any other.');
    });
  },
};

// ------------------------------------------------------------------ I·7  Debt
const c07 = {
  id: 'c07', ledger: 'I', chamber: 7, title: 'In the Red',
  tare: { capacity: 2, debt: true },
  build(L) {
    shell(L, { min: [-5, 0, -6], max: [5, 9, 6], theme: 'calib3', entry: { wall: 'z-', a: -2.2, text: 'LEDGER I  7' }, exit: { wall: 'z+', a: -1.5, y: 5.3, when: true },
      lights: [[-2.5, -3], [2.5, -3, { shadow: true }], [0, 1.5]] });
    // high ledge with the exit
    L.solid([-5, 5.0, 3.0], [5, 5.3, 6], 'terrazzo_dark', { bevel: 0.02 });
    L.props.railing([-4.9, 5.3, 3.05], [0.6, 5.3, 3.05], { h: 1.0 });
    L.props.railing([3.0, 5.3, 3.05], [4.9, 5.3, 3.05], { h: 1.0 });
    // a steel beam that stops a rising crate at ledge height
    L.solid([0.8, 7.15, 1.3], [2.8, 7.45, 3.0], 'paint_black', { bevel: 0.02, surface: 'metal' });
    L.props.cyl([1.8, 0, 2.1], 0, [0, 8.2, 0], 0.01, 0.01, 0.0001, 'steel_dark');
    L.crate({ pos: [1.8, 0, 2.2], weight: 0 });
    L.anchor({ pos: [-1.6, 0, 1.4], weight: 1 });
    L.crate({ pos: [-3.2, 0, -2.4], weight: 1 });
    chamberPlate(L, [0.0, 2.1, -5.97], 0, 'I', 7);
    L.props.poster([4.97, 2.2, -1.5], -PI / 2, 'debt', { seed: 2 });
    L.props.sign([1.8, 7.0, 3.0], PI, ['HEADROOM 1.8 M'], { w: 0.7, h: 0.14, bg: '#c39a3c', fg: '#1d1b19' });
    L.note({ pos: [-4.97, 1.6, -3.6], rotY: PI / 2, wall: true, doc: DOCS.debtMemo });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('brask', 'Hold on. There’s a latch on your fork — it stops you drawing past nothing. Officially it stays on.');
      await s.wait(0.6);
      await L.say('brask', '…It’s off now. Don’t tell her.');
      L.game.ui.flash('Debt latch released: you can draw below zero.', 3000);
      await L.say('brask', 'Anything that owes weight falls the other way. Try it on something with nothing left.');
    });
  },
};

// ------------------------------------------------------------------ I·8  First audit
const c08 = {
  id: 'c08', ledger: 'I', chamber: 8, title: 'Audited',
  tare: { capacity: 2, debt: true },
  build(L) {
    shell(L, { min: [-8, 0, -8], max: [8, 9, 8], theme: 'calib2', entry: { wall: 'z-', a: -4, text: 'LEDGER I  8' }, exit: { wall: 'z+', a: 4.0, y: 4.5, when: () => L.named.e.pressed },
      lights: [[-4, -4], [4, -4], [-4, 2], [4, 2, { shadow: true }]] });
    L.solid([-8, 4.2, 4.6], [8, 4.5, 8], 'terrazzo_dark', { bevel: 0.02 });
    L.props.railing([-7.9, 4.5, 4.65], [-5.15, 4.5, 4.65], { h: 1.0 });
    L.props.railing([-2.85, 4.5, 4.65], [7.9, 4.5, 4.65], { h: 1.0 });
    for (const x of [-6, 0, 6]) L.props.cyl([x, 0, 4.7], 0, [0, 2.1, 0], 0.14, 0.14, 4.2, 'paint_black', { seg: 10 });
    const lift = L.lift({ a: [-4, 0, 3.45], b: [4.0, 4.5, -3.0], size: [2.1, 2.1], range: [-4.5, 0], start: 0, ballast: [2, 2], railsA: 'xz', railsB: 'xzZ', pulleyY: 8.2 });
    const cp = L.plate({ pos: [0, 9, -2], need: 1, ceiling: true, dialAt: [1.2, 9, -2], dialRotY: 0 });
    L.named.cp = cp;
    L.onUpdate(() => { lift.locked = !cp.pressed; });
    const e = L.plate({ pos: [1.5, 4.5, 6.4], need: 3, exact: true, dialAt: [0.4, 4.5, 7.4], dialRotY: PI * 0.8 });
    L.named.e = e;
    L.crate({ pos: [0, 0, -2], weight: 0 });
    L.crate({ pos: [-6, 0, -3.5], weight: 1 });
    L.props.sign([-4, 2.6, 4.48], PI, ['LIFT BRAKE', 'RELEASED BY THE CEILING SCALE'], { w: 1.4, h: 0.36, bg: '#2f4a3f' });
    L.wire({ from: cp, points: [[0.4, 8.98, -2], [0.4, 8.98, 3.6], [-3.0, 8.98, 3.6]] });
    chamberPlate(L, [-1.8, 2.1, -7.97], 0, 'I', 8);
    obsWindow(L, [7.98, 6.5, -2], -PI / 2, { w: 3.0 });
    L.props.poster([-7.97, 2.2, -1.5], PI / 2, 'measure', { seed: 7 });
    L.props.radiator([3, 0, -7.95], 0);
    L.note({ pos: [6.9, 4.51, 6.6], rotY: 0.4, kind: 'clipboard', doc: DOCS.auditSheet });
  },
  start(L) {
    L.run(async s => {
      await s.wait(3);
      await L.say('varga', 'The last room of the familiarisation procedure. When you have balanced it, you may see our books. Such as they are.');
      await s.until(() => L.named.e.pressed);
      await s.wait(1.2);
      await L.say('varga', 'Familiarisation complete. You have balanced every room we gave you. The Bureau should be pleased; they so rarely send anyone who can count.');
      await L.say('brask', 'Next is the archive floors. The real books. Mind the damp.');
    });
  },
};

export default [c01, c02, c03, c04, c05, c06, c07, c08];
