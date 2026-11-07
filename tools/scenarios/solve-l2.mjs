import { readFileSync } from 'node:fs';
const base = readFileSync(new URL('./solve-l1.mjs', import.meta.url), 'utf8');
const SETUP_SRC = base.slice(base.indexOf('const SETUP'), base.indexOf('const LEVELS'));
const SETUP = new Function(SETUP_SRC + '; return SETUP;')();
const LEVELS = {
  c09: async (S, T) => {
    S.draw([-5.5, 0, -2.0], 0);                       // raft weightless
    S.place(0, -8.0, -0.35, 0);                       // into the channel
    await S.sim(1);
    const r = S.pos(0); T.teleport(r[0], r[1] + 0.4, r[2], -Math.PI / 2); await S.sim(4); // ride
    window.__ride = { raft: S.pos(0), player: T.player().pos };
    T.teleport(S.pos(0)[0], 0, 3.0, 0);               // step onto the north bank
    S.give([S.pos(0)[0], 0, 3.0], 0);                 // weight back (floats at 1)
    S.place(0, 6.2, 0.04, 4.2);                       // lift it out onto the scale
    await S.sim(2);
  },
  c10: async (S, T) => {
    S.draw([2.0, 4.5, 3.0], 0, 2);                    // reference crate 4 -> 2
    S.place(0, 0, 4.5, 2.6);                          // on the inspection glass
    await S.sim(1);
    S.give([2.5, 4.5, 0.5], 0, 2);                    // back to 4: the glass gives way
    await S.sim(4);
  },
  c11: async (S, T) => {
    S.place(0, 1.5, 0.04, -1.2);                      // twin onto the exact scale
    await S.sim(1);
    for (let k = 0; k < 3; k++) { S.draw([-3.5, 0, 0.0], 2, 2); S.give([-0.5, 0, -1.2], 0, 2); await S.sim(2); }
    await S.sim(1);
  },
  c12: async (S, T) => {
    for (const i of [0, 1]) {
      S.draw([0, 0, 0], i, 3);                        // person 4 -> 1
      S.give([0, 0, 2.0], 2, 3);                      // into the bank crate
      T.place(i, 4.1 + i * 0.95, 0.95, 1.4);          // pushed onto the big scale
      await S.sim(1.5);
      S.draw([1.5, 0, 2.5], 2, 3); S.give([2.0, 0, 1.4], i, 3);
      await S.sim(1);
    }
    await S.sim(1.5);
  },
  c13: async (S, T) => {
    S.draw([-1.5, 0, 22.0], 0, 3);                    // Agnes -> 0
    T.place(0, 0, 1.25, 24.0);
    await S.sim(1);
    S.give([0, 0, 21.5], 0, 3);
    await S.sim(2);
  },
  c14: async (S, T) => {
    await S.sim(1);
    S.draw([-4.5, 0, 1.5], 0, 2); S.give([0, 0, 1.5], 1, 2);
    S.draw([4.5, 0, 1.5], 2, 2); S.give([0, 0, 1.5], 1, 2);
    await S.sim(6);
  },
  c15: async (S, T) => {
    T.teleport(-4, 0.05, 1.9, 0); await S.sim(0.5);
    S.draw([-4, 0.05, 1.9], 0, 3); S.give([-4, 0.05, 1.9], 1, 3);
    T.teleport(-4, 0.05, 1.9, 0); await S.sim(5);
    window.__mid = T.player().pos;
    S.place(2, -4.2, 4.56, 5.6);                       // carry the weightless crate into the roofed cage
    T.teleport(-4.5, 4.56, 6.0, 0); await S.sim(0.5);
    S.draw([-4.5, 4.56, 6.0], 2, 3);                  // -3: it presses the roof, the cage rises
    T.teleport(-4.5, 4.56, 6.0, 0); await S.sim(6);
    window.__top = T.player().pos;
  },
  c16: async (S, T) => {
    await S.sim(15);                                        // the flood
    S.place(1, -5.7, 0.04, 0.6);                      // cargo at the bank edge
    S.place(0, -4.3, -0.4, 0);                        // raft into the brine
    await S.sim(1);
    const r = S.pos(0); T.teleport(r[0], r[1] + 0.4, r[2], Math.PI / 2); await S.sim(0.6);
    S.draw([r[0], r[1] + 0.4, r[2]], 0, 1);           // raft -> -1
    T.teleport(r[0], r[1] + 0.4, r[2], Math.PI / 2);
    T.lookAt(-5.7, 0.35, 0.6); T.use();               // pick up the cargo from the raft
    await S.sim(5);
    window.__raft = { raft: S.pos(0), player: T.player().pos, held: !!T.game.tare.held };
    T.game.tare.drop();
    T.teleport(6.5, 0, -1.5, 0);
    S.place(1, 7.0, 0.04, -3.5);
    await S.sim(2);
  },
  c17: async (S, T) => { T.teleport(0, 0, 0, Math.PI); await S.sim(70); },
};
export default async ({ page, shot, evalT }) => {
  await evalT(SETUP);
  const ids = await evalT(() => window.__tare.levels);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [id, fn] of Object.entries(LEVELS)) {
    if (only && !only.includes(id)) continue;
    await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(1.5); }, ids.indexOf(id));
    await evalT(SETUP);
    await page.evaluate(`(${fn.toString()})(window.S, window.__tare)`);
    const st = await evalT(() => window.S.state());
    const extra = await evalT(() => ({ ride: window.__ride, mid: window.__mid, top: window.__top, raft: window.__raft }));
    console.log(id.padEnd(5), st.cage >= 0.9 ? 'SOLVED' : 'NOT SOLVED', JSON.stringify(st), JSON.stringify(extra));
    await page.waitForTimeout(300);
    await shot('l2-' + id);
  }
};
