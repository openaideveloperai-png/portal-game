export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(1); window.__tare.teleport(0, 0, 0); window.__tare.look(0.4, -0.1); }, ids.indexOf('c01'));
  await page.waitForTimeout(1500);
  await shot('va-1');
  await evalT(() => { window.__tare.lookAt(2.2, 0.4, 2.2); });
  await page.waitForTimeout(800);
  await shot('va-2');
};
