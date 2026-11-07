export default async ({ page, shot, evalT }) => {
  await evalT(async () => { await window.__tare.goto(0); });
  await page.waitForTimeout(2000);
  await evalT(() => { window.__tare.teleport(0.2, 0, 0.4, 0); window.__tare.lookAt(0.2, 1.45, -3); });
  await page.waitForTimeout(1200);
  await shot('10-people');
  await evalT(() => { window.__tare.teleport(-2, 0, -1.6, 0); window.__tare.lookAt(-2, 1.62, -3); });
  await page.waitForTimeout(1200);
  await shot('11-brask-close');
  await evalT(() => { window.__tare.teleport(2.2, 0, -1.7, 0); window.__tare.lookAt(2.4, 1.5, -3); });
  await page.waitForTimeout(1200);
  await shot('12-varga-close');
  await evalT(() => { window.__tare.teleport(-4, 0, -5.5, Math.PI); window.__tare.lookAt(-4, 1.1, -8); });
  await page.waitForTimeout(1000);
  await shot('13-mannequins');
  await evalT(() => { window.__tare.teleport(0, 0, 8, 0); window.__tare.look(0, -0.15); });
  await page.waitForTimeout(800);
  await shot('14-room');
};
