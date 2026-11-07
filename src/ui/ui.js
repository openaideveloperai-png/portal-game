// DOM interface: loading, title, HUD, subtitles, pause ledger, settings, documents,
// journal and credits. Everything is styled as institute paperwork (see styles.css).
import { el } from '../core/util.js';
import { audio } from '../core/audio.js';

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.hud = el('div', { class: 'hud' });
    this.reticle = el('div', { class: 'reticle hidden' }, ['t', 'b', 'l', 'r', 'c'].map(c => el('i', { class: c })));
    this.readout = el('div', { class: 'readout', style: { opacity: 0 } });
    this.flashEl = el('div', { class: 'flash', style: { opacity: 0 } });
    this.cardEl = el('div', { class: 'card', style: { opacity: 0 } }, [el('div', { class: 'k' }), el('div', { class: 't' })]);
    this.hintEl = el('div', { class: 'hint', style: { opacity: 0 } });
    this.subs = el('div', { class: 'subs' });
    this.fadeEl = el('div', { class: 'fade' });
    this.hud.append(this.reticle, this.readout, this.flashEl, this.cardEl, this.hintEl, this.subs);
    root.append(this.hud, this.fadeEl);
    this.hud.classList.add('passive');
    this.fadeEl.classList.add('passive');
    this.docOpen = null;
    this.layer = null;
  }

  // ------------------------------------------------------------------ loading
  showLoading() {
    this.loadingEl = el('div', { class: 'loading' }, [el('div', { class: 'inner' }, [
      el('div', { class: 'org', text: 'State Institute of Ponderal Measures · Kalden' }),
      el('div', { class: 'line' }, [el('i')]),
      el('div', { class: 'status' }, [el('span', { class: 's', text: 'Opening the ledgers…' }), el('span', { class: 'p', text: '0%' })]),
    ])]);
    this.root.append(this.loadingEl);
  }
  setLoading(p, status) {
    if (!this.loadingEl) return;
    this.loadingEl.querySelector('.line i').style.width = Math.round(p * 100) + '%';
    this.loadingEl.querySelector('.p').textContent = Math.round(p * 100) + '%';
    if (status) this.loadingEl.querySelector('.s').textContent = status;
  }
  loadingError(msg) {
    if (!this.loadingEl) this.showLoading();
    this.loadingEl.querySelector('.inner').append(el('div', { class: 'warn', text: msg }));
  }
  hideLoading() {
    if (!this.loadingEl) return;
    const e = this.loadingEl; this.loadingEl = null;
    e.style.opacity = 0; setTimeout(() => e.remove(), 1300);
  }

  // ------------------------------------------------------------------ title
  showTitle({ canContinue, continueNote, onNew, onContinue, onChapters, onSettings, onCredits }) {
    this.hideTitle(true);
    const item = (label, fn, note = null, disabled = false) => el('li', {}, [el('button', { onclick: () => { audio.init(); audio.play('ui', { kind: 'select' }); fn(); }, onmouseenter: () => audio.play('ui', { kind: 'move' }), ...(disabled ? { disabled: '' } : {}) }, [label, note ? el('span', { class: 'note', text: note }) : null])]);
    this.titleEl = el('div', { class: 'title' }, [
      el('div', { class: 'block' }, [
        el('h1', { text: 'TARE' }),
        el('div', { class: 'sub', text: 'The Kalden Ledger' }),
        el('div', { class: 'rule' }),
        el('ul', { class: 'menu' }, [
          canContinue ? item('Continue the audit', onContinue, continueNote) : null,
          item(canContinue ? 'Begin again' : 'Begin the audit', onNew),
          item('Chapters', onChapters, null, !canContinue),
          item('Settings', onSettings),
          item('Credits', onCredits),
        ]),
      ]),
      el('div', { class: 'foot', html: '<b>KALDEN DAM · 1979</b><br>Mouse and keyboard. Headphones recommended.' }),
    ]);
    this.root.append(this.titleEl);
  }
  hideTitle(instant = false) {
    if (!this.titleEl) return;
    const e = this.titleEl; this.titleEl = null;
    if (instant) { e.remove(); return; }
    e.style.opacity = 0; setTimeout(() => e.remove(), 1400);
  }

  // ------------------------------------------------------------------ generic form overlay
  openForm(build, { onClose = null, cls = '' } = {}) {
    this.closeForm();
    const form = el('div', { class: 'paper form ' + cls });
    const ov = el('div', { class: 'overlay' }, [form]);
    ov.addEventListener('mousedown', e => { if (e.target === ov) { this.closeForm(); onClose?.(); } });
    build(form);
    this.root.append(ov);
    this.layer = ov;
    this.layerClose = onClose;
    return form;
  }
  closeForm() { if (this.layer) { this.layer.remove(); this.layer = null; } }
  get formOpen() { return !!this.layer; }

  showPause({ onResume, onRestart, onSettings, onJournal, onQuit, level }) {
    audio.play('paper');
    this.openForm(f => {
      f.append(
        el('h2', { text: 'Form P-2 · Suspension of Audit' }),
        el('h3', { text: level ? level.title : 'Paused' }),
        el('div', { class: 'small', text: level ? `Ledger ${level.ledger} · ${level.chamber ? 'Chamber ' + level.chamber : 'Interlude'}` : '' }),
        el('div', { class: 'ruled' }),
        el('div', { class: 'actions' }, [
          el('button', { text: 'Resume the audit', onclick: onResume }),
          el('button', { text: 'Restart this chamber', onclick: onRestart }),
          el('button', { text: 'Ledger of findings (documents read)', onclick: onJournal }),
          el('button', { text: 'Settings', onclick: onSettings }),
          el('button', { text: 'Leave the Institute (title)', onclick: onQuit }),
        ]),
        el('div', { class: 'small', html: 'Move <b>WASD</b> · Jump <b>Space</b> · Draw a measure <b>Left mouse</b> · Give a measure <b>Right mouse</b><br>Lift / use / read <b>E</b> · Shove or throw <b>Q</b> · Hold <b>R</b> to restart the chamber' }),
      );
      const st = el('div', { class: 'stamp small', text: 'Suspended', style: { right: '36px', top: '30px' } });
      f.append(st);
    }, { onClose: onResume });
  }

  showSettings(settings, onChange, onBack) {
    this.openForm(f => {
      const row = (label, control) => el('div', { class: 'row' }, [el('label', { text: label }), control]);
      const range = (key, min, max, step, fmt = v => v) => {
        const val = el('span', { class: 'val', text: fmt(settings[key]) });
        const inp = el('input', { type: 'range', min, max, step, value: settings[key] });
        inp.addEventListener('input', () => { settings[key] = parseFloat(inp.value); val.textContent = fmt(settings[key]); onChange(key); });
        return el('span', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, [inp, val]);
      };
      const toggle = (key, a = 'On', b = 'Off') => {
        const t = el('button', { class: 'toggle', text: settings[key] ? a : b });
        t.onclick = () => { settings[key] = !settings[key]; t.textContent = settings[key] ? a : b; onChange(key); };
        return t;
      };
      const select = (key, opts) => {
        const s = el('select', {}, opts.map(([v, l]) => el('option', { value: v, text: l })));
        s.value = settings[key];
        s.onchange = () => { settings[key] = s.value; onChange(key); };
        return s;
      };
      f.append(
        el('h2', { text: 'Form S-1 · Instrument Settings' }),
        el('h3', { text: 'Settings' }),
        row('Picture quality', select('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])),
        row('Field of view', range('fov', 60, 100, 1, v => v + '°')),
        row('Mouse sensitivity', range('sensitivity', 0.2, 3, 0.05, v => (+v).toFixed(2))),
        row('Invert vertical look', toggle('invertY')),
        row('Head bob', toggle('headBob')),
        row('Master volume', range('master', 0, 1, 0.05, v => Math.round(v * 100))),
        row('Music', range('music', 0, 1, 0.05, v => Math.round(v * 100))),
        row('Voices (murmur under subtitles)', range('voice', 0, 1, 0.05, v => Math.round(v * 100))),
        row('Subtitle size', range('subSize', 14, 28, 1, v => v + 'px')),
        el('div', { class: 'small', text: 'Picture quality takes effect after reloading the page.' }),
        el('div', { class: 'actions' }, [el('button', { text: 'Done', onclick: onBack })]),
      );
    }, { onClose: onBack });
  }

  showChapters(levels, unlocked, onPick, onBack) {
    this.openForm(f => {
      f.append(el('h2', { text: 'Form C-4 · Index of Chambers' }), el('h3', { text: 'Chapters' }));
      const list = el('div', { class: 'list journal', style: { maxHeight: '54vh', overflow: 'auto' } });
      levels.forEach((l, i) => {
        if (i > unlocked) return;
        list.append(el('button', { class: 'item', text: `${l.ledger === 'P' ? 'Prologue' : 'Ledger ' + l.ledger}${l.chamber ? ' · ' + l.chamber : ''} — ${l.title}`, onclick: () => onPick(i) }));
      });
      f.append(list, el('div', { class: 'actions' }, [el('button', { text: 'Back', onclick: onBack })]));
    }, { onClose: onBack });
  }

  showJournal(entries, onBack) {
    this.openForm(f => {
      f.append(el('h2', { text: 'Ledger of Findings' }), el('h3', { text: `${entries.length} document${entries.length === 1 ? '' : 's'} recovered` }));
      const list = el('div', { class: 'list' });
      for (const d of entries) list.append(el('button', { class: 'item', text: d.title || d.id, onclick: () => this.showDocument(d, () => this.showJournal(entries, onBack)) }));
      if (!entries.length) list.append(el('div', { class: 'small', text: 'Nothing yet. Documents you read are filed here.' }));
      f.append(list, el('div', { class: 'actions' }, [el('button', { text: 'Back', onclick: onBack })]));
    }, { cls: 'journal', onClose: onBack });
  }

  // ------------------------------------------------------------------ documents
  showDocument(doc, onClose) {
    this.closeForm();
    const close = () => { ov.remove(); this.docOpen = null; audio.play('paper'); onClose?.(); this.game.onDocumentClosed?.(); };
    let sheet;
    if (doc.kind === 'photo') {
      sheet = el('div', { class: 'paper doc photo' }, [
        doc.image ? el('img', { src: doc.image, alt: doc.caption || 'photograph' }) : null,
        el('div', { class: 'caption', text: doc.caption || '' }),
      ]);
    } else if (doc.kind === 'note') {
      sheet = el('div', { class: 'paper doc note-card' }, [el('div', { class: 'body', text: doc.text })]);
      if (doc.sign) sheet.append(el('div', { class: 'hand', style: { textAlign: 'right', marginTop: '8px' }, text: '— ' + doc.sign }));
    } else {
      sheet = el('div', { class: 'paper doc' });
      sheet.append(el('div', { class: 'letterhead' }, [
        el('div', { class: 'org', text: doc.org || 'State Institute of Ponderal Measures' }),
        el('div', { class: 'dept', text: doc.dept || 'Kalden · Office of the Director' }),
      ]));
      if (doc.meta) sheet.append(el('div', { class: 'meta', html: doc.meta.map(([k, v]) => `<b>${k}:</b> ${v}`).join('<br>') }));
      const body = el('div', { class: 'body' });
      for (const part of [].concat(doc.body || [])) {
        if (typeof part === 'string') body.append(el('p', { html: part }));
        else if (part.hand) body.append(el('p', { class: 'hand' + (part.red ? ' red' : ''), text: part.hand }));
        else if (part.table) {
          const t = el('table');
          if (part.head) t.append(el('tr', {}, part.head.map(h => el('th', { text: h }))));
          for (const r of part.table) t.append(el('tr', {}, r.map((c, i) => el('td', { class: (i > 0 && /^[−-]?\d/.test(String(c)) ? 'num' : '') + (/^[−-]\d/.test(String(c)) ? ' neg' : ''), text: c }))));
          body.append(t);
        }
      }
      sheet.append(body);
      if (doc.sig) sheet.append(el('div', { class: 'sig' }, [el('div', { class: doc.sigScript ? 'script' : 'hand', text: doc.sig }), doc.sigName ? el('div', { class: 'meta', text: doc.sigName }) : null]));
    }
    for (const s of doc.stamps || []) sheet.append(el('div', { class: 'stamp' + (s.violet ? ' violet' : '') + (s.small ? ' small' : ''), text: s.text, style: { right: (s.right ?? 40) + 'px', top: (s.top ?? 40) + 'px', transform: `rotate(${s.rot ?? -9}deg)` } }));
    sheet.append(el('div', { class: 'close passive', text: 'E / Esc to put down' }));
    const ov = el('div', { class: 'overlay' }, [sheet]);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    this.root.append(ov);
    this.docOpen = { close };
    this.game.onDocumentOpened?.();
  }

  // ------------------------------------------------------------------ HUD
  setReticle(state) {
    this.reticle.className = 'reticle ' + (state || '');
  }
  setReadout(html) {
    if (this._ro === html) return;
    this._ro = html;
    this.readout.innerHTML = html || '';
    this.readout.style.opacity = html ? 1 : 0;
  }
  flash(text, ms = 1600) {
    this.flashEl.textContent = text;
    this.flashEl.style.opacity = 1;
    clearTimeout(this._ft);
    this._ft = setTimeout(() => { this.flashEl.style.opacity = 0; }, ms);
  }
  card(k, t, ms = 5200) {
    this.cardEl.querySelector('.k').textContent = k;
    this.cardEl.querySelector('.t').textContent = t;
    this.cardEl.style.opacity = 1;
    clearTimeout(this._ct);
    this._ct = setTimeout(() => { this.cardEl.style.opacity = 0; }, ms);
  }
  hint(html, ms = 6000) {
    this.hintEl.innerHTML = html;
    this.hintEl.style.opacity = 1;
    clearTimeout(this._ht);
    if (ms > 0) this._ht = setTimeout(() => { this.hintEl.style.opacity = 0; }, ms);
  }
  hideHint() { this.hintEl.style.opacity = 0; }
  showHud(on) { this.hud.style.display = on ? '' : 'none'; }

  subtitle(who, cls, text, dur) {
    const line = el('div', { class: 'line' }, [el('span', { class: 'who ' + cls, text: who }), el('span', { text })]);
    this.subs.append(line);
    while (this.subs.children.length > 2) this.subs.firstChild.remove();
    setTimeout(() => { line.style.opacity = 0; setTimeout(() => line.remove(), 400); }, dur * 1000);
    return line;
  }
  clearSubtitles() { this.subs.innerHTML = ''; }

  // pointer-lock prompt
  showResume(onClick, text = 'Click to continue') {
    this.hideResume();
    this.resumeEl = el('div', { class: 'resume' }, [el('div', { class: 'box', html: `${text}<small>Esc pauses · the mouse is captured while you play</small>` })]);
    this.resumeEl.addEventListener('mousedown', e => { e.preventDefault(); onClick(); });
    this.root.append(this.resumeEl);
  }
  hideResume() { this.resumeEl?.remove(); this.resumeEl = null; }

  fade(to, ms = 1000) {
    return new Promise(res => {
      this.fadeEl.style.transition = `opacity ${ms}ms ease`;
      this.fadeEl.style.opacity = to;
      setTimeout(res, ms);
    });
  }

  showCredits(onDone, { ending = false } = {}) {
    this.closeForm();
    const roll = el('div', { class: 'roll' }, [
      el('h1', { text: 'TARE' }),
      el('div', { class: 'sub', style: { fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--bone-dim)' }, text: 'The Kalden Ledger' }),
      el('h4', { text: 'Design, writing, code, materials and sound' }),
      el('p', { text: 'Made for this project. Every texture and every sound in the game is generated by its own code.' }),
      el('h4', { text: 'People and animation' }),
      el('p', { html: 'Universal Base Characters and Universal Animation Library 1 & 2<br>by Quaternius — CC0 1.0' }),
      el('h4', { text: 'Type' }),
      el('p', { html: 'Barlow Condensed (Jeremy Tribby) · Courier Prime (Alan Dague-Greene)<br>Old Standard TT (Alexey Kryukov) · Reenie Beanie (James Grieshaber) · La Belle Aurore (Kimberly Geswein)<br>SIL Open Font License' }),
      el('h4', { text: 'Libraries' }),
      el('p', { text: 'three.js (MIT) · Rapier physics (Apache-2.0)' }),
      el('div', { class: 'end', text: ending ? 'Halde, 1949 — Kalden, 1979.' : 'Thank you for weighing in.' }),
      el('div', { class: 'small', style: { marginTop: '34px', fontSize: '12px', color: '#847c6f' }, text: 'Click to return' }),
    ]);
    const c = el('div', { class: 'credits' }, [roll]);
    c.addEventListener('mousedown', () => { c.remove(); onDone?.(); });
    this.root.append(c);
    return c;
  }
}
