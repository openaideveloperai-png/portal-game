import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
for (const a of doc.getRoot().listAnimations().slice(0, 3)) {
  const byPath = {};
  for (const ch of a.listChannels()) {
    const p = ch.getTargetPath(); byPath[p] = byPath[p] || [];
    byPath[p].push(ch.getTargetNode().getName());
  }
  const s = a.listSamplers()[0];
  console.log(a.getName(), 'frames', s.getInput().getCount(), 'dur', s.getInput().getMax([])[0].toFixed(2), Object.entries(byPath).map(([k, v]) => k + ':' + v.length + (k==='translation' ? ' [' + v.join(',') + ']' : '')).join(' | '));
}
