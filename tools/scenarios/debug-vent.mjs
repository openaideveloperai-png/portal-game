export default async ({ page, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(1); }, ids.indexOf('c19'));
  const r = await evalT(async () => {
    const T = window.__tare, L = T.game.level, c = L.weighted[0];
    const out = [];
    T.place(0, 2.5, 0.4, 0.5);
    for (let i = 0; i < 10; i++) { await T.simulate(0.5); const v = c.body.linvel(); out.push(`t=${(i + 1) * 0.5} y=${c.position().y.toFixed(2)} vy=${v.y.toFixed(2)} sleep=${c.body.isSleeping()} gs=${c.body.gravityScale()}`); }
    return out;
  });
  console.log(r.join('\n'));
};
