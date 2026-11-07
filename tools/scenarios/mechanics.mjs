export default async ({ page, shot, evalT }) => {
  const log = (k, v) => console.log(k.padEnd(28), JSON.stringify(v));
  await evalT(async () => { await window.__tare.goto(0); });
  await page.waitForTimeout(1500);
  const T = 'window.__tare';
  // 1. draw from crate (w1) -> 0
  log('aim crate1', await evalT(() => { window.__tare.teleport(-2, 0, 7, 0); window.__tare.lookAt(-2, 0.35, 4); return window.__tare.aim(); }));
  log('draw', await evalT(() => window.__tare.draw()));
  log('weights', await evalT(() => window.__tare.weights().map(w => w.w)));
  // 2. debt: draw again -> -1, should rise
  log('draw again (debt)', await evalT(() => window.__tare.draw()));
  await page.waitForTimeout(2500);
  log('crate1 after debt', await evalT(() => window.__tare.weights()[0]));
  // 3. give both back to crate2 (w2 -> 4)
  log('aim crate2', await evalT(() => { window.__tare.teleport(2, 0, 7, 0); window.__tare.lookAt(2, 0.35, 4); return window.__tare.aim(); }));
  log('give', await evalT(() => window.__tare.give()));
  log('give', await evalT(() => window.__tare.give()));
  log('weights', await evalT(() => window.__tare.weights().map(w => w.w)));
  // 4. place crate2 (now 4) on the plate (need 3)
  await evalT(() => { const c = window.__tare.game.level.weighted[1]; c.body.setTranslation({ x: 0, y: 0.5, z: 0 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); });
  await page.waitForTimeout(2500);
  log('plates', await evalT(() => window.__tare.plates()));
  log('doors', await evalT(() => window.__tare.doors()));
  await evalT(() => { window.__tare.teleport(0, 0, 4, 0); window.__tare.lookAt(0, 1.2, -10); });
  await page.waitForTimeout(400);
  await shot('20-door-open');
  // 5. stack crate3 (w3) on top of crate2 -> load 7
  await evalT(() => { const c = window.__tare.game.level.weighted[2]; c.body.setTranslation({ x: 0, y: 1.3, z: 0 }, true); });
  await page.waitForTimeout(2000);
  log('plates stacked', await evalT(() => window.__tare.plates()));
  // 6. remove crates, stand on the plate (player w2) -> 2 (not enough), then booth makes heavier
  await evalT(() => { const L = window.__tare.game.level; L.weighted[1].body.setTranslation({ x: 3, y: 0.5, z: 0 }, true); L.weighted[2].body.setTranslation({ x: 4.5, y: 0.5, z: 0 }, true); window.__tare.teleport(0, 0.05, 0, 0); });
  await page.waitForTimeout(2000);
  log('player on plate', await evalT(() => [window.__tare.plates(), window.__tare.player()]));
  // 7. vent: crate1 is in debt at the ceiling; give it back 2 so it's w1 then move into vent
  await evalT(() => { const c = window.__tare.game.level.weighted[0]; c.setWeight(1); c.body.setTranslation({ x: 7, y: 0.6, z: -6 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); });
  await page.waitForTimeout(3000);
  log('crate1 in vent (w1)', await evalT(() => window.__tare.weights()[0]));
  await evalT(() => { window.__tare.teleport(4, 0, -2, 0); window.__tare.lookAt(7, 2.5, -6); });
  await page.waitForTimeout(300);
  await shot('21-vent');
  // 8. carrying
  await evalT(() => { const c = window.__tare.game.level.weighted[0]; c.setWeight(2); c.body.setTranslation({ x: -3, y: 0.4, z: 2 }, true); window.__tare.teleport(-3, 0, 3.8, 0); window.__tare.lookAt(-3, 0.35, 2); });
  await page.waitForTimeout(800);
  log('use (pick)', await evalT(() => window.__tare.use()));
  await page.waitForTimeout(800);
  log('held pos', await evalT(() => window.__tare.weights()[0]));
  await shot('22-carry');
};
