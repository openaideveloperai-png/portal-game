export default async ({ page, shot, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  const view = async (id, p, look, name, sim = 1.5) => {
    await evalT(async ([i, p, look, sim]) => { await window.__tare.goto(i); await window.__tare.simulate(sim); if (p) window.__tare.teleport(p[0], p[1], p[2]); if (look) window.__tare.lookAt(look[0], look[1], look[2]); }, [ids.indexOf(id), p, look, sim]);
    await page.waitForTimeout(1600);
    await shot(name);
  };
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = n => !only || only.includes(n);
  if (want('halde')) await view('c25', [-21.8, 4, 1.6], [-6, 7, 0], 'f-halde');
  if (want('spillway')) await view('c24', null, null, 'f-spillway');
  if (want('spillway2')) await view('c24', [-4, 0, -5], [9, 5, 0], 'f-spillway2');
  if (want('mountains')) await view('finale', [-6, 0, 1.5], [-40, 2, -20], 'f-mountains');
  if (want('crest')) await view('finale', null, null, 'f-crest');
  if (want('night')) await view('prologue', null, null, 'f-night');
};
