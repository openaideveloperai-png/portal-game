export default async ({ page, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); window.__tare.simulate(1.5); }, ids.indexOf('c07'));
  const r = await evalT(() => {
    const T = window.__tare, g = T.game, L = g.level, R = L.weighted[0];
    const out = [];
    const snap = tag => { const p = g.player; out.push(tag + ' crate=' + R.position().toArray().map(v => v.toFixed(2)) + ' w=' + R.weight + ' feet=' + p.feet(new p.pos.constructor()).toArray().map(v => v.toFixed(2)) + ' gr=' + p.grounded + ' gc=' + (p.groundCollider ? (L.phys.infoOf(p.groundCollider)?.kind) : 'none')); };
    T.teleport(1.8, 0.75, 2.2, 0); T.simulate(0.5); snap('start');
    T.lookAt(1.8, 0.3, 2.2); T.draw(); T.draw(); T.simulate(0.5); snap('after -2');
    T.lookAt(-1.6, 0.5, 1.4); T.give(); T.give(); T.simulate(0.2); snap('gave');
    T.lookAt(1.8, 0.3, 2.2); T.draw(); snap('drew -3');
    for (let i = 0; i < 8; i++) { T.simulate(0.4); snap('t' + i); }
    return out;
  });
  console.log(r.join('\n'));
};
