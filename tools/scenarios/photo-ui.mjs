// Show each photograph in the in-game document viewer.
export default async ({ page, shot, evalT }) => {
  await evalT(async () => { await window.__tare.goto(1); await window.__tare.simulate(0.5); });
  for (const k of ['photoAgnes', 'photoOpening', 'photoHalde']) {
    await evalT(async k => { const { DOCS } = await import('/src/levels/docs.js'); window.__tare.game.ui.showDocument(DOCS[k], () => {}); }, k);
    await page.waitForTimeout(1200);
    await shot('ui-' + k);
    await evalT(() => window.__tare.game.ui.closeForm?.() || window.__tare.game.ui.closeDocument?.());
    await page.waitForTimeout(400);
  }
};
