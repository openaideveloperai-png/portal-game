// Keyboard + mouse input with pointer lock. Game code polls `down`, `pressed`, `released`
// once per frame; `endFrame()` clears the edge-triggered sets.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 1;
    this.invertY = false;
    this.onLockChange = null;
    this.onEscape = null;
    this.wheel = 0;

    const code = e => (e.code === 'ArrowUp' ? 'KeyW' : e.code === 'ArrowDown' ? 'KeyS' : e.code === 'ArrowLeft' ? 'KeyA' : e.code === 'ArrowRight' ? 'KeyD' : e.code);
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const c = code(e);
      if (c === 'Escape') { this.onEscape?.(); return; }
      if (['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c) && this.locked) e.preventDefault();
      if (!this.down.has(c)) this.pressed.add(c);
      this.down.add(c);
    });
    window.addEventListener('keyup', e => { const c = code(e); this.down.delete(c); this.released.add(c); });
    window.addEventListener('blur', () => { for (const c of this.down) this.released.add(c); this.down.clear(); });

    canvas.addEventListener('mousedown', e => {
      const c = 'Mouse' + e.button;
      if (!this.locked) return;
      e.preventDefault();
      if (!this.down.has(c)) this.pressed.add(c);
      this.down.add(c);
    });
    window.addEventListener('mouseup', e => { const c = 'Mouse' + e.button; if (this.down.has(c)) { this.down.delete(c); this.released.add(c); } });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });

    document.addEventListener('mousemove', e => {
      if (!this.locked || !this.enabled) return;
      // Clamp spikes some browsers produce right after locking.
      const dx = Math.max(-250, Math.min(250, e.movementX || 0));
      const dy = Math.max(-250, Math.min(250, e.movementY || 0));
      this.mouseDX += dx; this.mouseDY += dy;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { for (const c of this.down) this.released.add(c); this.down.clear(); }
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; this.onLockChange?.(false, true); });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* ignored */ } });
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* ignored */ }
    }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  isDown(c) { return this.enabled && this.down.has(c); }
  wasPressed(c) { return this.enabled && this.pressed.has(c); }
  wasReleased(c) { return this.released.has(c); }

  consumeMouse() {
    const s = 0.0022 * this.sensitivity;
    const out = { x: this.mouseDX * s, y: this.mouseDY * s * (this.invertY ? -1 : 1) };
    this.mouseDX = 0; this.mouseDY = 0;
    return out;
  }

  endFrame() { this.pressed.clear(); this.released.clear(); this.wheel = 0; }
}
