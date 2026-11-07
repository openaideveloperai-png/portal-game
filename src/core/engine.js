// Renderer, scenes, cameras, environment lighting and the main loop.
import * as THREE from 'three';
import { Post } from '../render/post.js';
import { Materials } from '../render/materials.js';
import { WORLD } from '../render/materials.js';

export const QUALITY = {
  low: { pixelRatio: 0.75, shadow: 1024, tex: 512, shadows: true, post: 'low' },
  medium: { pixelRatio: 1.0, shadow: 1024, tex: 512, shadows: true, post: 'medium' },
  high: { pixelRatio: 1.5, shadow: 2048, tex: 1024, shadows: true, post: 'high' },
};

// A warm, dim institutional room used to light reflections (brass, glazed tile, glass).
function buildEnvScene() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 14), new THREE.MeshBasicMaterial({ color: 0x3b3833, side: THREE.BackSide }));
  room.position.y = 2.6;
  s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0x2a2621 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.39;
  s.add(floor);
  const lamp = (x, z, w, d, c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) }));
    m.rotation.x = Math.PI / 2; m.position.set(x, 5.5, z); s.add(m);
  };
  lamp(-2.5, 0, 0.5, 5, 0xfff1d8, 9);
  lamp(2.5, 0, 0.5, 5, 0xfff1d8, 9);
  lamp(0, -5, 4, 0.4, 0xd9e6ff, 3);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fb2c4).multiplyScalar(1.6) }));
  win.position.set(0, 2.4, 6.9); win.rotation.y = Math.PI; s.add(win);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb36b).multiplyScalar(2.2) }));
  warm.position.set(-6.9, 1.6, 0); warm.rotation.y = Math.PI / 2; s.add(warm);
  return s;
}

export class Engine {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.q = QUALITY[settings.quality] || QUALITY.medium;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = this.q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0a09);
    this.camera = new THREE.PerspectiveCamera(settings.fov || 72, 1, 0.05, 600);
    this.scene.add(this.camera);

    // First-person viewmodel: rendered after the world with a cleared depth buffer so
    // the instrument never clips into walls.
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.viewScene.add(this.viewCamera);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTexture = pmrem.fromScene(buildEnvScene(), 0.035).texture;
    pmrem.dispose();
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.35;
    this.viewScene.environment = this.envTexture;
    this.viewScene.environmentIntensity = 0.5;

    this.materials = new Materials(renderer, { texSize: this.q.tex });
    this.post = new Post(renderer, this.scene, this.camera, this.viewScene, this.viewCamera, { quality: this.q.post });

    this.clock = new THREE.Clock();
    this.time = 0;
    this.fixedDt = 1 / 60;
    this.acc = 0;
    this.onFixed = null;   // (dt) => void   — physics/gameplay at 60 Hz
    this.onFrame = null;   // (dt, alpha) => void — per rendered frame
    this.running = false;
    this.frameMs = 16;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setFov(f) { this.camera.fov = f; this.camera.updateProjectionMatrix(); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h; this.viewCamera.updateProjectionMatrix();
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(s.x, s.y);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      const t0 = performance.now();
      let dt = this.clock.getDelta();
      if (dt > 0.1) dt = 0.1;
      this.time += dt;
      WORLD.uTime.value = this.time;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= this.fixedDt && steps < 5) {
        this.onFixed?.(this.fixedDt);
        this.acc -= this.fixedDt; steps++;
      }
      if (steps >= 5) this.acc = 0;
      this.onFrame?.(dt, this.acc / this.fixedDt);
      this.post.render(dt, this.time);
      this.frameMs = this.frameMs * 0.95 + (performance.now() - t0) * 0.05;
    };
    requestAnimationFrame(tick);
  }

  stop() { this.running = false; }
}
