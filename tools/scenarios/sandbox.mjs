export default async ({ page, shot, evalT }) => {
  await shot('00-title');
  await evalT(async () => { await window.__tare.goto(0); });
  await page.waitForTimeout(1500);
  await evalT(() => { window.__tare.teleport(0, 0, 8, 0); window.__tare.look(0, -0.15); });
  await page.waitForTimeout(800);
  await shot('01-sandbox-front');
  await evalT(() => { window.__tare.teleport(-5, 0, 5, Math.PI * 0.75); window.__tare.look(Math.PI * 0.75, -0.1); });
  await page.waitForTimeout(800);
  await shot('02-sandbox-corner');
  console.log(JSON.stringify(await evalT(() => ({ fps: 1000 / window.__tare.game.engine.frameMs, w: window.__tare.weights(), p: window.__tare.plates(), d: window.__tare.doors() }))));
};
