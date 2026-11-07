// Develop the three period photographs and save them as files for review.
import fs from 'node:fs';
export default async ({ evalT }) => {
  const out = process.argv[3] || '/tmp/claude-0/-home-user-portal-game/c8fafbbd-ccbb-5edd-a7d9-1cf59beecae2/scratchpad/shots';
  for (const k of (process.env.ONLY || 'halde,agnes,opening').split(',')) {
    const t0 = Date.now();
    const url = await evalT(k => window.__tare.photo(k), k);
    fs.writeFileSync(`${out}/photo-${k}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('photo', k, (Date.now() - t0) + 'ms', Math.round(url.length / 1024) + 'KB');
  }
};
