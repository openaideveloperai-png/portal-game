// Plays the intended solution of each Ledger I chamber and checks the exit opens.
const SETUP = () => {
  const T = window.__tare;
  const g = T.game;
  window.S = {
    w: i => g.level.weighted[i],
    pos: i => g.level.weighted[i].position().toArray(),
    // stand at p (feet) and aim at weighted i (or a point), then act
    aimFrom(p, target) { T.teleport(p[0], p[1], p[2]); const t = typeof target === 'number' ? this.pos(target) : target; T.lookAt(t[0], t[1], t[2]); return T.aim(); },
    draw(p, i, n = 1) { const a = this.aimFrom(p, i); for (let k = 0; k < n; k++) T.draw(); return a; },
    give(p, i, n = 1) { const a = this.aimFrom(p, i); for (let k = 0; k < n; k++) T.give(); return a; },
    place(i, x, y, z) { T.place(i, x, y + this.w(i).size / 2 + 0.02, z); },
    sim(s) { T.simulate(s); },
    state() { return { w: g.level.weighted.map(x => x.weight), plates: T.plates(), cage: T.cageOpen(), player: T.player(), stored: g.tare.stored }; },
  };
};
const LEVELS = {
  c01: async (S, T) => {
    S.draw([-1.0, 0, -1.0], 1);          // the crate on the ledge
    S.give([1.0, 0, 0.0], 0);            // the crate on the scale
    S.sim(2);
  },
  c02: async (S, T) => {
    S.place(0, -1.5, 0.04, 3.2);         // A (2) onto P1
    S.place(1, 2.6, 0.04, 3.2);          // B (1) onto P2
    S.sim(1);
    S.draw([-3.0, 0, 0.5], 2); S.give([1.0, 0, 1.2], 1);
    S.draw([-3.0, 0, 0.5], 2); S.give([1.0, 0, 1.2], 1);
    S.sim(2);
  },
  c03: async (S, T) => {
    // draw two from the reference crate into the floating bank crate, carry it up, pay it back
    S.draw([-2.5, 0, 0], 0); S.give([-2.5, 0, 0], 1);
    S.draw([-2.5, 0, 0], 0); S.give([-2.5, 0, 0], 1);
    S.place(0, 5.3, 0.59, 0);
    S.sim(1);
    S.draw([2.0, 0, -1.0], 1); S.give([3.6, 0.55, 1.0], 0);
    S.draw([2.0, 0, -1.0], 1); S.give([3.6, 0.55, 1.0], 0);
    S.sim(2);
  },
  c04: async (S, T) => {
    S.draw([-6.5, 0, -0.5], 0);          // crate weightless
    S.place(0, 4.5, 0.6, -1.0);          // (a shove carries it across; placement stands in for the throw)
    S.sim(1);
    S.give([6.0, 0, 0.5], 0);            // weight back on the far side
    S.sim(1);
    S.place(0, 5.6, 0.04, -2.6);
    S.sim(2);
  },
  c05: async (S, T) => {
    S.draw([-2.8, 0, -0.5], 0);          // 5 -> 4 on E1
    S.place(2, 2.4, 0.04, -0.6);         // C (2) on E2
    S.place(1, 2.4, 0.8, -0.6);          // B (1) stacked on C
    S.sim(1.5);
    S.give([0.4, 0, -2.0], 2);           // +1 -> 4
    S.sim(2);
  },
  c06: async (S, T) => {
    T.teleport(-2, 0.05, 3.35, 0); S.sim(1);
    S.draw([-2, 0.05, 3.0], 0, 2);         // A ballast (index 0) -> 0, while standing in A
    S.give([-2, 0.05, 3.0], 1, 2);         // B ballast up on the gallery side -> 4
    T.teleport(-2, 0.05, 3.35, 0);
    S.sim(5);
  },
  c07: async (S, T) => {
    T.teleport(1.8, 0.75, 2.2, 0); S.sim(0.5);
    S.draw([1.8, 0.75, 2.2], 0, 2);     // crate under foot -> -2 (hover)
    S.give([1.8, 0.75, 2.2], 1, 2);     // into the anchor
    T.teleport(1.8, 0.75, 2.2, 0); S.sim(0.3);
    S.draw([1.8, 0.75, 2.2], 0, 1);     // -> -3, rises with us
    S.sim(4);
    T.teleport(1.8, 5.32, 3.6, 0); S.sim(0.5);   // step onto the ledge
  },
  c08: async (S, T) => {
    S.draw([0, 0, 0], 2);                 // weightless crate under the ceiling scale -> -1
    S.sim(4);
    T.teleport(-4, 0.05, 3.2, 0); S.sim(0.5);
    S.place(3, -4.4, 0.06, 3.0);         // carry the one-crate into cage A
    S.sim(1);
    S.give([-3.6, 0.05, 3.6], 1, 1);     // B ballast 3
    S.draw([-3.6, 0.05, 3.6], 0, 2);     // A ballast 0
    S.give([-3.6, 0.05, 3.6], 1, 2);     // B ballast 5
    T.teleport(-3.6, 0.05, 3.6, 0);
    S.sim(5);
    S.place(3, 1.5, 4.54, 6.4);          // the crate onto the exact scale on the gallery
    T.teleport(1.0, 4.55, 5.0, 0);
    S.sim(1);
    S.draw([1.0, 4.55, 5.0], 1, 2);      // from B ballast below
    S.give([1.0, 4.55, 5.0], 3, 2);      // crate -> 3
    S.sim(2);
  },
};
export default async ({ page, shot, evalT }) => {
  await evalT(SETUP);
  const ids = await evalT(() => window.__tare.levels);
  for (const [id, fn] of Object.entries(LEVELS)) {
    const idx = ids.indexOf(id);
    await evalT(async i => { await window.__tare.goto(i); window.__tare.simulate(1.5); }, idx);
    await evalT(SETUP);
    await page.evaluate(`(${fn.toString()})(window.S, window.__tare)`);
    const st = await evalT(() => window.S.state());
    console.log(id.padEnd(5), st.cage >= 0.9 ? 'SOLVED' : 'NOT SOLVED', JSON.stringify(st));
    await page.waitForTimeout(300);
    await shot('l1-' + id);
  }
};
