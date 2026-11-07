import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  console.log('=====', f.split('/').pop());
  console.log('meshes:', root.listMeshes().map(m => m.getName() + '(' + m.listPrimitives().map(p => p.getAttribute('POSITION').getCount()+'v').join(',') + ')').join(' | '));
  console.log('materials:', root.listMaterials().map(m => m.getName()).join(', '));
  console.log('textures:', root.listTextures().map(t => t.getName() + ' ' + t.getMimeType() + ' ' + (t.getSize()||[]).join('x')).join(', '));
  const skins = root.listSkins();
  for (const s of skins) console.log('skin joints(' + s.listJoints().length + '):', s.listJoints().map(j => j.getName()).join(' '));
  const anims = root.listAnimations();
  console.log('animations(' + anims.length + '):', anims.map(a => a.getName()).join(', '));
}
