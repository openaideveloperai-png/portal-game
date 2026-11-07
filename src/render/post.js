// Post-processing: scene -> depth-based AO -> viewmodel -> bloom -> tone map -> grade.
// The grade is restrained on purpose: a slight film-like split tone, vignette and grain,
// no chromatic aberration, no heavy glow.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const QUAD_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ---------------------------------------------------------------- AO
class DepthAOPass extends Pass {
  constructor(camera, { samples = 12 } = {}) {
    super();
    this.camera = camera;
    this.needsSwap = true;
    this.enabled = true;
    this.strength = 0.75;
    this.aoRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.blurRT = this.aoRT.clone();
    this.aoMat = new THREE.ShaderMaterial({
      defines: { NUM: samples },
      uniforms: {
        tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uFullRes: { value: new THREE.Vector2() },
        uRadius: { value: 0.55 }, uIntensity: { value: 0.9 }, uBias: { value: 0.02 }, uProjScale: { value: 500 },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tDepth; uniform mat4 uProjInv; uniform vec2 uFullRes;
        uniform float uRadius, uIntensity, uBias, uProjScale;
        varying vec2 vUv;
        vec3 vpos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 p = uProjInv * vec4(uv * 2. - 1., d * 2. - 1., 1.); return p.xyz / p.w; }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          float d = texture2D(tDepth, vUv).x;
          if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e5, 0., 1.); return; }
          vec3 P = vpos(vUv);
          vec2 px = 1.0 / uFullRes;
          vec3 Pr = vpos(vUv + vec2(px.x, 0.)), Pl = vpos(vUv - vec2(px.x, 0.));
          vec3 Pu = vpos(vUv + vec2(0., px.y)), Pd = vpos(vUv - vec2(0., px.y));
          vec3 dx = (abs(Pr.z - P.z) < abs(P.z - Pl.z)) ? Pr - P : P - Pl;
          vec3 dy = (abs(Pu.z - P.z) < abs(P.z - Pd.z)) ? Pu - P : P - Pd;
          vec3 N = normalize(cross(dx, dy));
          float ssR = min(uProjScale * uRadius / max(-P.z, 0.05), 140.0);
          float rnd = hash(gl_FragCoord.xy) * 6.2831;
          float sum = 0.0;
          for (int i = 0; i < NUM; i++) {
            float a = (float(i) + 0.5) / float(NUM);
            float ang = float(i) * 2.3999 + rnd;
            vec2 off = vec2(cos(ang), sin(ang)) * a * ssR * px;
            vec3 Q = vpos(vUv + off);
            vec3 v = Q - P; float vv = dot(v, v); float vn = dot(v, N);
            float f = max(uRadius * uRadius - vv, 0.0);
            sum += f * f * f * max((vn - uBias) / (0.012 + vv), 0.0);
          }
          float r2 = uRadius * uRadius;
          float ao = clamp(1.0 - sum * uIntensity * 5.0 / (r2 * r2 * r2 * float(NUM)), 0.0, 1.0);
          gl_FragColor = vec4(ao, -P.z, 0., 1.);
        }`,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tAO: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tAO; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec2 c = texture2D(tAO, vUv).xy;
          float sum = c.x * 0.2; float wsum = 0.2;
          for (int i = 1; i <= 4; i++) {
            float w = 0.2 * exp(-float(i * i) * 0.18);
            for (int s = -1; s <= 1; s += 2) {
              vec2 t = texture2D(tAO, vUv + uDir * float(i * s)).xy;
              float dw = w * exp(-abs(t.y - c.y) / max(c.y * 0.04, 0.02));
              sum += t.x * dw; wsum += dw;
            }
          }
          gl_FragColor = vec4(sum / wsum, c.y, 0., 1.);
        }`,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, uStrength: { value: 0.75 } },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tAO; uniform float uStrength; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float ao = texture2D(tAO, vUv).x;
          c.rgb *= mix(1.0, ao, uStrength);
          gl_FragColor = c;
        }`,
    });
    this.quad = new FullScreenQuad(null);
  }

  setSize(w, h) {
    const hw = Math.max(1, Math.floor(w / 2)), hh = Math.max(1, Math.floor(h / 2));
    this.aoRT.setSize(hw, hh); this.blurRT.setSize(hw, hh);
    this.aoMat.uniforms.uFullRes.value.set(w, h);
    this.fullH = h;
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    const u = this.aoMat.uniforms;
    u.tDepth.value = readBuffer.depthTexture;
    u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uProjScale.value = this.fullH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    renderer.setRenderTarget(this.aoRT);
    this.quad.material = this.aoMat; this.quad.render(renderer);
    const bu = this.blurMat.uniforms;
    bu.tAO.value = this.aoRT.texture; bu.uDir.value.set(1 / this.aoRT.width, 0);
    renderer.setRenderTarget(this.blurRT); this.quad.material = this.blurMat; this.quad.render(renderer);
    bu.tAO.value = this.blurRT.texture; bu.uDir.value.set(0, 1 / this.aoRT.height);
    renderer.setRenderTarget(this.aoRT); this.quad.render(renderer);
    const cu = this.compMat.uniforms;
    cu.tDiffuse.value = readBuffer.texture; cu.tAO.value = this.aoRT.texture; cu.uStrength.value = this.strength;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.material = this.compMat; this.quad.render(renderer);
  }

  dispose() { this.aoRT.dispose(); this.blurRT.dispose(); this.aoMat.dispose(); this.blurMat.dispose(); this.compMat.dispose(); this.quad.dispose(); }
}

// ---------------------------------------------------------------- grade
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.9 }, uGrain: { value: 0.035 },
    uFade: { value: 0 }, uSat: { value: 0.9 }, uContrast: { value: 1.06 },
    uLift: { value: new THREE.Vector3(-0.004, 0.006, 0.006) }, uGain: { value: new THREE.Vector3(1.03, 1.0, 0.95) },
    uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 0.95, 0.85) }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uFade, uSat, uContrast, uFlash;
    uniform vec3 uLift, uGain, uFlashColor; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      c += uLift * (1.0 - smoothstep(0.0, 0.45, l));
      c *= mix(vec3(1.0), uGain, smoothstep(0.25, 0.95, l));
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y * 0.75;
      c *= 1.0 - dot(q, q) * uVignette * 0.9;
      float g = hash(floor(vUv * uRes) + floor(fract(uTime * 24.0) * 97.0)) - 0.5;
      c += g * uGrain * (0.35 + 0.65 * (1.0 - abs(l - 0.45) * 1.6));
      c = mix(c, uFlashColor, uFlash);
      c = mix(c, vec3(0.0), uFade);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, viewScene, viewCamera, { quality = 'high' } = {}) {
    this.renderer = renderer;
    this.quality = quality;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const msaa = quality === 'high' ? 4 : 0;
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, samples: msaa,
      depthTexture: new THREE.DepthTexture(size.x, size.y),
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.ao = new DepthAOPass(camera, { samples: quality === 'high' ? 14 : 8 });
    this.ao.enabled = quality !== 'low';
    this.composer.addPass(this.ao);
    this.viewPass = new RenderPass(viewScene, viewCamera);
    this.viewPass.clear = false;
    this.viewPass.clearDepth = true;
    this.composer.addPass(this.viewPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.92);
    this.bloom.enabled = quality !== 'low';
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.enabled = msaa === 0;
    this.composer.addPass(this.fxaa);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.setSize(size.x, size.y);
  }

  get uniforms() { return this.grade.uniforms; }

  setSize(w, h) {
    this.composer.setSize(w / this.renderer.getPixelRatio(), h / this.renderer.getPixelRatio());
    this.ao.setSize(w, h);
    this.fxaa.uniforms.resolution.value.set(1 / w, 1 / h);
    this.grade.uniforms.uRes.value.set(w, h);
  }

  render(dt, time) {
    this.grade.uniforms.uTime.value = time;
    this.composer.render(dt);
  }

  dispose() { this.composer.dispose(); this.ao.dispose(); }
}
