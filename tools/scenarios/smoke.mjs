// Built-bundle smoke test: boot, a few chambers, the photographs.
export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  for (const id of ['c03', 'c14', 'c25']) {
    await evalT(async i => { await window.__tare.goto(i); await window.__tare.simulate(1); }, ids.indexOf(id));
    await page.waitForTimeout(1200);
    await shot('smoke-' + id);
  }
  const sizes = await evalT(() => ['halde', 'agnes', 'opening'].map(k => Math.round(window.__tare.photo(k).length / 1024)));
  console.log('photo sizes KB', sizes.join(', '));
};
