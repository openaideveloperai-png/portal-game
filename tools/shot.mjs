// Headless browser harness: loads the game, runs a scenario, saves screenshots,
// and prints console errors. Usage: node tools/shot.mjs <scenario.js> [outdir]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const scenarioFile = process.argv[2];
const outDir = process.argv[3] || '/tmp/claude-0/-home-user-portal-game/c8fafbbd-ccbb-5edd-a7d9-1cf59beecae2/scratchpad/shots';
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5173/?nolock&quality=' + (process.env.Q || 'low');
const W = +(process.env.W || 960), H = +(process.env.H || 540);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(`[${t}] ${m.text()}`); if (process.env.LOG) console.log('console:', m.text()); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
const shot = async name => { const f = path.join(outDir, name + '.png'); await page.screenshot({ path: f }); console.log('shot', f); };
const evalT = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(fn).catch(() => false)) return true; await page.waitForTimeout(250); } return false; };
const ok = await waitFor(() => window.__tare && window.__tare.game.state === 'title', 180000);
console.log('boot', ok ? 'ok' : 'TIMEOUT', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const scenario = (await import(path.resolve(scenarioFile))).default;
try { await scenario({ page, shot, evalT, waitFor }); } catch (e) { console.log('SCENARIO ERROR', e.message); }
console.log('--- console errors/warnings (' + errors.length + ')');
for (const e of errors.slice(0, 40)) console.log(e);
await browser.close();
