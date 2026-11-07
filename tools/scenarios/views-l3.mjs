export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  const view = async (id, p, look, name, sim = 1.5, info = false) => {
    await evalT(async ([i, p, look, sim]) => { await window.__tare.goto(i); await window.__tare.simulate(sim); window.__tare.teleport(p[0], p[1], p[2]); window.__tare.lookAt(look[0], look[1], look[2]); }, [ids.indexOf(id), p, look, sim]);
    await page.waitForTimeout(1600);
    await shot(name);
    if (info) console.log(name, JSON.stringify(await evalT(() => { const r = window.__tare.game.engine.renderer.info.render; return { calls: r.calls, tris: r.triangles, lights: window.__tare.game.level.lights.length }; })));
  };
  await view('c22', [-12, 0, 6], [10, 4, -2], 'v-turbine', 1.5, true);
  await view('c24', [-16, 0, 1.5], [6, 4, 0], 'v-spillway', 1.5, true);
  await view('c25', [-22.5, 4, 1.2], [0, 9, 0], 'v-halde', 1.5, true);
  await view('c26', [-8, 0, 1], [8, 2, 0], 'v-vault', 1.5, true);
  await view('finale', [-6, 0, 1.5], [7, 1.4, -3], 'v-dawn', 1.5, true);
  await view('c13', [0, 0, -18], [0, 1.4, 0], 'v-hall-info', 1.5, true);
};
