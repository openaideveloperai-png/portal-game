// Prints rest-pose world positions of key joints for the base bodies.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const world = new Map();
  const walk = (n, parent) => { const m = mul(parent, n.getMatrix()); world.set(n.getName(), m); for (const c of n.listChildren()) walk(c, m); };
  const I = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  for (const s of doc.getRoot().listScenes()) for (const n of s.listChildren()) walk(n, I);
  const want = ['pelvis','spine_01','spine_03','neck_01','Head','clavicle_l','upperarm_l','lowerarm_l','hand_l','middle_01_l','middle_04_leaf_l','thigh_l','calf_l','foot_l','ball_l','upperarm_r','hand_r'];
  console.log('==', f.split('/').pop());
  for (const w of want) { const m = world.get(w); if (m) console.log(w.padEnd(18), [m[12], m[13], m[14]].map(v => v.toFixed(3)).join(', ')); }
  for (const mesh of doc.getRoot().listMeshes()) {
    const p = mesh.listPrimitives()[0].getAttribute('POSITION');
    console.log('mesh', mesh.getName(), 'min', p.getMin([]).map(v=>v.toFixed(3)).join(','), 'max', p.getMax([]).map(v=>v.toFixed(3)).join(','), 'type', p.getComponentType());
  }
}
