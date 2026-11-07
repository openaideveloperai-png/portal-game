// Entry point: settings, engine, input, UI, game.
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { UI } from './ui/ui.js';
import { Game } from './game/game.js';
import { Save, loadSettings } from './core/save.js';
import { audio } from './core/audio.js';

function webgl2() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}

async function main() {
  const canvas = document.getElementById('view');
  const uiRoot = document.getElementById('ui');
  const settings = loadSettings();
  const q = new URLSearchParams(location.search).get('quality');
  if (q && ['low', 'medium', 'high'].includes(q)) settings.quality = q;
  if (!webgl2()) {
    uiRoot.innerHTML = '<div class="loading"><div class="inner"><div class="org">State Institute of Ponderal Measures</div><div class="warn">This browser cannot open WebGL 2. TARE needs a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</div></div></div>';
    return;
  }
  const engine = new Engine(canvas, settings);
  const input = new Input(canvas);
  const ui = new UI(null, uiRoot);
  const game = new Game(engine, input, settings, new Save(), ui);
  window.addEventListener('pointerdown', () => audio.init(), { once: true });
  window.addEventListener('keydown', () => audio.init(), { once: true });
  window.__tare = game.debugApi();
  try {
    await game.boot();
  } catch (e) {
    console.error(e);
    ui.loadingError('Something went wrong while opening the Institute: ' + (e && e.message ? e.message : e));
  }
}
main();
