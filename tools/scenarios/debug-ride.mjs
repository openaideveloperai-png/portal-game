export default async ({ page, evalT }) => {
  const ids = await evalT(() => window.__tare.levels);
  await evalT(async i => { await window.__tare.goto(i); window.__tare.simulate(1.5); }, ids.indexOf('c07'));
  const r = await evalT(() => {
    const T = window.__tare;
    T.teleport(1.8, 0.75, 2.2, 0); T.simulate(0.5);
    T.lookAt(1.8, 0.3, 2.2); T.draw(); T.draw(); T.simulate(0.3);
    T.lookAt(-1.6, 0.5, 1.4); T.give(); T.give(); T.simulate(0.2);
    T.lookAt(1.8, 0.3, 2.2); T.draw();
    window.__rideDebug = [];
    T.simulate(0.15);
    return window.__rideDebug;
  });
  console.log(JSON.stringify(r));
};
