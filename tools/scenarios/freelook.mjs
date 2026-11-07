// Pointer-lock fallback: begin a game with a real click; if the browser refuses the lock,
// the game should switch to drag-to-look and treat still clicks as button presses.
export default async ({ page, shot, evalT }) => {
  await page.getByText('Begin the audit').click();
  await page.waitForTimeout(2500);
  let st = await evalT(() => { const i = window.__tare.game.input; return { locked: i.locked, free: i.freeLook, ple: !!document.pointerLockElement, state: window.__tare.game.state }; });
  console.log('after begin', JSON.stringify(st));
  if (!st.free) {
    // the lock was granted (or never answered): force the fallback to exercise it
    await evalT(() => { const i = window.__tare.game.input; i.unlock(); i.lockFailed = false; i.freeLook = false; i.enterFreeLook(); });
    console.log('forced free look');
  }
  await page.waitForTimeout(500);
  await shot('freelook-hint');
  await evalT(() => {
    const i = window.__tare.game.input; window.__clicks = 0;
    const add = i.pressed.add.bind(i.pressed); i.pressed.add = c => { if (c === 'Mouse0') window.__clicks++; return add(c); };
  });
  const yaw0 = await evalT(() => window.__tare.game.player.yaw);
  await page.mouse.move(480, 300); await page.mouse.down(); await page.mouse.move(640, 300, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const yaw1 = await evalT(() => window.__tare.game.player.yaw);
  const clicksAfterDrag = await evalT(() => window.__clicks);
  await page.mouse.move(480, 300); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(300);
  const clicksAfterClick = await evalT(() => window.__clicks);
  st = await evalT(() => { const i = window.__tare.game.input; return { locked: i.locked, free: i.freeLook, paused: window.__tare.game.paused }; });
  console.log('drag turned yaw by', (yaw1 - yaw0).toFixed(3), '| clicks after drag', clicksAfterDrag, '| clicks after still click', clicksAfterClick, '|', JSON.stringify(st));
  // Esc pauses, resuming re-enters free look
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const paused = await evalT(() => window.__tare.game.paused);
  await evalT(() => window.__tare.game.resume()); await page.waitForTimeout(300);
  st = await evalT(() => { const i = window.__tare.game.input; return { locked: i.locked, free: i.freeLook, paused: window.__tare.game.paused }; });
  console.log('esc paused:', paused, '| after resume', JSON.stringify(st));
};
