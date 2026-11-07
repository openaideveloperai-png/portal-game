const CANDS = [
  { pos: [0.22, -0.2, -0.45], rot: [-0.25, 0.6, 0.15], s: 0.8 },
  { pos: [0.24, -0.17, -0.42], rot: [-0.35, 0.75, 0.25], s: 0.75 },
  { pos: [0.2, -0.16, -0.4], rot: [-0.45, 0.9, 0.35], s: 0.7 },
  { pos: [0.26, -0.2, -0.46], rot: [-0.2, 0.5, 0.0], s: 0.85 },
];
export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(1); window.__tare.teleport(0, 0, 0); window.__tare.look(0.4, -0.1); }, ids.indexOf('c01'));
  for (let i = 0; i < CANDS.length; i++) {
    await evalT(c => { const t = window.__tare.game.tare; t.vmBase = { pos: c.pos, rot: c.rot }; t.vm.scale.setScalar(c.s); }, CANDS[i]);
    await page.waitForTimeout(900);
    await shot('vm-' + i);
  }
};
