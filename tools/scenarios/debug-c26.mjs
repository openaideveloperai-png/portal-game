export default async ({ page, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(42); }, ids.indexOf('c26'));
  const r = await evalT(async () => {
    const T = window.__tare, g = T.game, out = [];
    out.push('after scene: ' + JSON.stringify(T.player()));
    T.teleport(5.6, 8.0, 0.6); await T.simulate(0.5);
    out.push('at post: ' + JSON.stringify(T.player()) + ' center=' + g.player.pos.toArray().map(v => v.toFixed(2)));
    T.lookAt(6.0, 6.55, 0);
    out.push('aim: ' + JSON.stringify(T.aim()));
    const e = g.player.eyeNow(new g.player.pos.constructor()); const f = g.player.forwardWorld(new g.player.pos.constructor());
    out.push('eye=' + e.toArray().map(v => v.toFixed(2)) + ' fwd=' + f.toArray().map(v => v.toFixed(2)));
    for (let k = 0; k < 4; k++) { T.lookAt(6.0, 6.55, 0); T.give(); await T.simulate(0.15); out.push('give ' + k + ' ' + JSON.stringify(T.player())); }
    await T.simulate(3);
    out.push('end: ' + JSON.stringify(T.player()));
    return out;
  });
  console.log(r.join('\n'));
};
