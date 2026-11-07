// Close look at a few people (checks textures and outfits load).
export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(1); }, ids.indexOf('finale'));
  await evalT(() => { window.__tare.teleport(4.2, 0, -1.2); window.__tare.lookAt(6.8, 1.4, -3.0); });
  await page.waitForTimeout(1500);
  await shot('csp-people');
  const sizes = await evalT(() => ['halde', 'agnes', 'opening'].map(k => Math.round(window.__tare.photo(k).length / 1024)));
  console.log('photo sizes KB', sizes.join(', '));
};
