import { readFileSync } from 'node:fs';
const base = readFileSync(new URL('./solve-l1.mjs', import.meta.url), 'utf8');
const SETUP_SRC = base.slice(base.indexOf('const SETUP'), base.indexOf('const LEVELS'));
const SETUP = new Function(SETUP_SRC + '; return SETUP;')();
const LEVELS = {
  c18: async (S, T) => {
    const booth = [-5.6, 0, -3.4];
    S.draw(booth, 0, 2);                                     // anchor (index 0) -> 0
    S.give(booth, [-6.15, 1.45, -3.4], 2);                   // the booth dial -> you are 4
    window.__w4 = T.player().w;
    T.teleport(1.2, 0.05, -3.6); await S.sim(1.5);          // stand on the scale: latch
    S.draw(booth, [-6.15, 1.45, -3.4], 3);                   // you -> 1
    T.teleport(1.0, 0, 0.5); await S.sim(0.5);
    window.__jump = await T.jumpHeight(2.5);
    T.teleport(5, 2.02, 4); await S.sim(1);
  },
  c19: async (S, T) => {
    S.draw([-4.6, 0, -1.5], [-5.15, 1.45, -1.5], 1);        // you -> 1
    T.teleport(2.5, 0.05, 0.5); await S.sim(9);
    window.__vent = T.player().pos;
    S.place(0, 2.5, 0.05, 0.5); await S.sim(8);               // the crate rides up on its own
    window.__crate = S.pos(0);
    T.teleport(4.6, 10.02, 0.6); await S.sim(0.5);
    S.place(0, 4.9, 10.05, -0.6); await S.sim(0.5);
    S.give([4.6, 10.02, 1.4], 0, 1); await S.sim(2);
  },
  c20: async (S, T) => {
    const booth = [-4.4, 4.5, 4.8];
    S.draw(booth, 0, 2); S.give(booth, [-4.95, 5.95, 4.8], 2); // you -> 4
    T.teleport(0, 4.52, 2.9); await S.sim(3);                  // the glass gives way under you
    window.__fell = T.player().pos;
    S.place(1, 3.4, 0.05, -3.6); await S.sim(1);              // the crate on the scale...
    T.teleport(3.4, 0.8, -3.6); await S.sim(1.5);             // ...and you (4) standing on it
  },
  c21: async (S, T) => {
    S.draw([-9.6, 0, 1.2], 1, 1); S.give([-9.5, 0, -1.4], 0, 1); // 3 -> 2, 1 -> 2
    for (const i of [0, 1]) { S.place(i, -6.5, 0.12, 0); await S.sim(3.5); }
    window.__landed = [S.pos(0), S.pos(1)];
    S.place(0, 6.6, 0.04, -2.2); S.place(1, 6.6, 0.8, -2.2); await S.sim(1.5);
    T.teleport(-6.5, 0.12, 0, -Math.PI / 2); await S.sim(4);
    window.__flew = T.player().pos;
  },
  c22: async (S, T) => {
    const booth = [-14.2, 0, 2.5];
    S.draw(booth, 0, 2); S.give(booth, [-14.75, 1.45, 2.5], 2);
    S.place(1, -12.5, 0.05, -7.0); await S.sim(1);
    T.teleport(-12.5, 0.8, -7.0); await S.sim(1.5);          // you (4) on the crate (2) on the scale
    S.draw(booth, [-14.75, 1.45, 2.5], 2);
    T.teleport(14.0, 0.05, -0.7); await S.sim(12);
    window.__top = T.player().pos;
  },
  c23: async (S, T) => {
    const post = [-6.0, 0, 3.6];
    T.teleport(-5.0, 0, 3.0); S.draw([-5.0, 0, 3.0], [-6.0, 1.45, 3.6], 4); // you -> -2
    await S.sim(2.5);
    window.__ceil = T.player().pos;
    T.teleport(0, 7.0, 0); await S.sim(1.5);                  // stand (inverted) on the ceiling scale
    T.teleport(4.6, 7.0, -3.0); await S.sim(0.5);
    for (let k = 0; k < 4; k++) { T.lookAt(5.4, 5.55, -3.4); T.give(); await S.sim(0.15); }
    await S.sim(2.5);
    window.__down = T.player().pos;
    T.teleport(8.0, 0, 0); await S.sim(1);
  },
  c24: async (S, T) => {
    T.teleport(-7.0, 0, 0.8); S.draw([-7.0, 0, 0.8], [-7.6, 1.45, 0], 4); await S.sim(3);
    window.__under = T.player().pos;
    T.teleport(7.0, 5.6, 0.6); await S.sim(0.5);
    for (let k = 0; k < 4; k++) { T.lookAt(7.8, 4.15, 0); T.give(); await S.sim(0.15); }
    await S.sim(3);
    window.__east = T.player().pos;
    T.teleport(19, 0, 0); await S.sim(1);
  },
  c25: async (S, T) => {
    // houses are weighted[1..5] after the booth? find them by name
    const H = T.game.level.named.houses;
    const idx = H.map(h => T.game.level.weighted.indexOf(h));
    T.teleport(-22.6, 4.02, -1.0);
    S.draw([-22.6, 4.02, -1.0], [-23.0, 5.45, -2.0], 1);     // you -> 1
    S.draw([-22.5, 4.02, 0], idx[0], 1);                     // H1 1 -> 0
    S.draw([-22.5, 4.02, 0], idx[2], 2);                     // H3 0 -> -2
    S.give([-22.5, 4.02, 0], idx[1], 2);                     // H2 -3 -> -1
    await S.sim(8);
    T.teleport(-14.6, 6.02, 2.4); await S.sim(0.5);
    S.draw([-14.6, 6.02, 2.4], idx[3], 1);                   // H4 -2 -> -3
    await S.sim(6);
    T.teleport(-6.2, 10.02, 1.2); await S.sim(0.5);
    S.give([-6.2, 10.02, 1.2], idx[4], 2);                   // H5 -6 -> -4 (from the roof of H4)
    await S.sim(8);
    window.__houses = H.map(h => +h.h.toFixed(2));
    window.__jump = await T.jumpHeight(2.5);
    T.teleport(3.2, 13.85, 0.5); await S.sim(55);
    T.lookAt(2.6, 15.4, 0); T.use(); await S.sim(12);
  },
  c26: async (S, T) => {
    await S.sim(42);
    window.__inv = T.player();
    T.teleport(5.6, 8.0, 0.6); await S.sim(0.5);
    for (let k = 0; k < 4; k++) { T.lookAt(6.0, 6.55, 0); T.give(); await S.sim(0.15); }
    await S.sim(3);
    window.__floor = T.player().pos;
    const L = T.game.level, lift = L.named.balance;
    const ia = L.weighted.indexOf(lift.ballast[0]), ib = L.weighted.indexOf(lift.ballast[1]);
    S.draw([5.6, 0, 0], ia, 2); S.give([5.6, 0, 0], ib, 2);
    await S.sim(8);
  },
  finale: async (S, T) => {
    T.teleport(4, 0, 0); await S.sim(40);
    window.__doc = !!T.game.ui.docOpen;
    T.game.ui.docOpen?.close();
    await S.sim(8);
    window.__state = T.game.state;
  },
};
export default async ({ page, shot, evalT }) => {
  await evalT(SETUP);
  const ids = await evalT(() => window.__tare.levels);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [id, fn] of Object.entries(LEVELS)) {
    if (only && !only.includes(id)) continue;
    await evalT(async i => { for (const k of Object.keys(window)) if (k.startsWith('__') && k !== '__tare') delete window[k]; await window.__tare.goto(i); await window.__tare.simulate(1.5); }, ids.indexOf(id));
    await evalT(SETUP);
    await page.evaluate(`(${fn.toString()})(window.S, window.__tare)`);
    const st = await evalT(() => window.S.state());
    const extra = await evalT(() => Object.fromEntries(Object.entries(window).filter(([k]) => k.startsWith('__') && k !== '__tare' && k !== '__rideDebug')));
    const ok = id === 'finale' ? extra.__state === 'ending' : st.cage >= 0.9; // the epilogue has no exit lift: it ends the game
    console.log(id.padEnd(6), ok ? 'SOLVED' : 'NOT SOLVED', JSON.stringify({ w: st.w.slice(0, 8), plates: st.plates, cage: st.cage, player: st.player }), JSON.stringify(extra));
    await page.waitForTimeout(300);
    await shot('l3-' + id);
  }
};
