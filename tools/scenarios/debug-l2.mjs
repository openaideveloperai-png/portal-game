export default async ({ page, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  // c16 raft
  await evalT(async i => { await window.__tare.goto(i); window.__tare.simulate(16); }, ids.indexOf('c16'));
  const r16 = await evalT(() => {
    const T = window.__tare, g = T.game, L = g.level, R = L.weighted[0], C = L.weighted[1];
    const out = [];
    const snap = tag => out.push(tag + ' raft=' + R.position().toArray().map(v => v.toFixed(2)) + ' w=' + R.weight + ' ridden=' + R.ridden + ' gs=' + R.body.gravityScale().toFixed(2) + ' player=' + T.player().pos + ' riding=' + !!g.player.riding + ' held=' + (g.tare.held ? g.tare.held.weight : '-') + ' surf=' + L.named.brine.surface.toFixed(2));
    T.place(1, -5.7, 0.04, 0.6); T.place(0, -4.3, -0.4, 0); T.simulate(1); snap('raft in');
    const r = R.position(); T.teleport(r.x, r.y + 0.4, r.z, Math.PI / 2); T.simulate(0.6); snap('boarded');
    T.lookAt(r.x, r.y - 0.2, r.z); T.draw(); T.simulate(0.5); snap('drew');
    T.lookAt(-5.7, 0.35, 0.6); T.use(); T.simulate(0.3); snap('picked');
    for (let i = 0; i < 5; i++) { T.simulate(0.5); snap('t' + i); }
    return out;
  });
  console.log(r16.join('\n'));
  // c17 story
  await evalT(async i => { await window.__tare.goto(i); window.__tare.simulate(1); }, ids.indexOf('c17'));
  const r17 = await evalT(() => {
    const T = window.__tare, g = T.game, L = g.level;
    T.teleport(0, 0, 0, Math.PI);
    const out = [];
    for (let i = 0; i < 8; i++) { T.simulate(8); out.push((i * 8 + 8) + 's permit=' + L.flags.permit + ' subs=' + document.querySelector('.subs')?.textContent.slice(0, 70) + ' t=' + g.story.time.toFixed(1)); }
    return out;
  });
  console.log(r17.join('\n'));
};
