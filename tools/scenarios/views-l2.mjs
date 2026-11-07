export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  const view = async (id, p, look, name, sim = 1.5) => {
    await evalT(async ([i, p, look, sim]) => { await window.__tare.goto(i); await window.__tare.simulate(sim); window.__tare.teleport(p[0], p[1], p[2]); window.__tare.lookAt(look[0], look[1], look[2]); }, [ids.indexOf(id), p, look, sim]);
    await page.waitForTimeout(1500);
    await shot(name);
  };
  await view('c13', [0, 0, -18], [0, 1.4, 0], 'v-hall312');
  await view('c13', [0.6, 0, 18.5], [-3.6, 1.2, 22.5], 'v-hall312-end');
  await view('c14', [0, 0, -6], [0, 4.5, 8], 'v-ledgerhall');
  await view('c17', [-2.5, 0, -3.5], [6.0, 1.5, 1.2], 'v-office', 2);
  await view('c16', [-7.5, 0, -1], [3, -0.5, 0], 'v-flood', 16);
};
