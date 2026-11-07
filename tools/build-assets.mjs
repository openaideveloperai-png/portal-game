// Builds the compact runtime character assets from the CC0 Quaternius sources.
//
//   node tools/build-assets.mjs <path-to-source-checkout>
//
// Sources (all CC0 1.0, by Quaternius):
//   - Universal Base Characters [Standard]
//   - Universal Animation Library [Standard] (UAL1) and Universal Animation Library 2 [Standard] (UAL2)
//
// Output goes to public/assets/models. The script:
//   * shrinks textures and re-encodes them as WebP,
//   * keeps only the animation clips the game uses,
//   * strips per-bone translation/scale tracks (keeping root + pelvis) so the clips
//     do not overwrite each body's own bone lengths,
//   * quantizes + meshopt-compresses geometry and animation data.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node tools/build-assets.mjs <source-dir>'); process.exit(1); }
const OUT = path.resolve('public/assets/models');
await fs.mkdir(OUT, { recursive: true });
await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const UBC = path.join(SRC, 'Universal Base Characters[Standard]/Universal Base Characters[Standard]');
const BODY_DIR = path.join(UBC, 'Base Characters/Godot - UE');
const HAIR_DIR = path.join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
const UAL1 = path.join(SRC, 'Universal Animation Library[Standard]/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const UAL2 = path.join(SRC, 'Universal Animation Library 2[Standard]/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb');
const MANNEQUIN_F = path.join(SRC, 'Universal Animation Library 2[Standard]/Universal Animation Library 2[Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb');

async function compressTextures(doc, { size = 1024, normalSize = size, quality = 82 } = {}) {
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normalTexture/, resize: [normalSize, normalSize], quality: 90 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!normalTexture).*/, resize: [size, size], quality }),
  );
}

async function finish(doc, file, { geometry = true } = {}) {
  const steps = [dedup(), prune()];
  if (geometry) steps.push(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  steps.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  const out = path.join(OUT, file);
  await io.write(out, doc);
  const { size } = await fs.stat(out);
  console.log(`${file.padEnd(22)} ${(size / 1024).toFixed(0).padStart(6)} KB`);
}

// ---------------------------------------------------------------- bodies
for (const [name, file] of [['body_m', 'Superhero_Male_FullBody.gltf'], ['body_f', 'Superhero_Female_FullBody.gltf']]) {
  const doc = await io.read(path.join(BODY_DIR, file));
  await compressTextures(doc, { size: 1024, normalSize: 1024 });
  await finish(doc, `${name}.glb`);
}

// alternate skin albedos, swapped in at runtime by the clothing baker
for (const [name, file] of [
  ['skin_m_light', 'Base Characters/Textures/T_Superhero_Male_Ligh.png'],
  ['skin_m_dark', 'Base Characters/Godot - UE/T_Superhero_Male_Dark.png'],
  ['skin_f_light', 'Base Characters/Textures/T_Superhero_Female_Light_BaseColor.png'],
  ['skin_f_dark', 'Base Characters/Godot - UE/T_Superhero_Female_Dark_BaseColor.png'],
]) {
  const src = path.join(UBC, file);
  const out = path.join(OUT, `${name}.webp`);
  await sharp(src).resize(1024, 1024).webp({ quality: 84 }).toFile(out);
  console.log(`${(name + '.webp').padEnd(22)} ${((await fs.stat(out)).size / 1024).toFixed(0).padStart(6)} KB`);
}

// ---------------------------------------------------------------- hair
for (const [name, file] of [
  ['hair_parted', 'Hair_SimpleParted.gltf'],
  ['hair_buns', 'Hair_Buns.gltf'],
  ['hair_long', 'Hair_Long.gltf'],
  ['hair_beard', 'Hair_Beard.gltf'],
  ['hair_buzzed', 'Hair_Buzzed.gltf'],
]) {
  const doc = await io.read(path.join(HAIR_DIR, file));
  await compressTextures(doc, { size: 512, normalSize: 512 });
  await finish(doc, `${name}.glb`);
}

function disposeAnimation(a) {
  for (const ch of a.listChannels()) ch.dispose();
  for (const s of a.listSamplers()) s.dispose();
  a.dispose();
}

// Rotation keyframes are unit quaternions, so 16-bit normalized integers are plenty.
// three.js' GLTFLoader de-normalizes integer animation outputs on load.
function quantizeRotations(doc) {
  for (const a of doc.getRoot().listAnimations()) {
    for (const ch of a.listChannels()) {
      if (ch.getTargetPath() !== 'rotation') continue;
      const out = ch.getSampler().getOutput();
      const src = out.getArray();
      if (!(src instanceof Float32Array)) continue;
      const q = new Int16Array(src.length);
      for (let i = 0; i < src.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, src[i])) * 32767);
      out.setArray(q).setNormalized(true);
    }
  }
}

// ---------------------------------------------------------------- mannequins (mesh only)
for (const [name, file] of [['mannequin_m', UAL1], ['mannequin_f', MANNEQUIN_F]]) {
  const doc = await io.read(file);
  for (const a of doc.getRoot().listAnimations()) disposeAnimation(a);
  await finish(doc, `${name}.glb`);
}

// ---------------------------------------------------------------- animations (no mesh)
const KEEP_TRANSLATION = new Set(['root', 'pelvis']);
async function animPack(file, keep, out) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (!keep.includes(a.getName())) { disposeAnimation(a); continue; }
    for (const ch of a.listChannels()) {
      const p = ch.getTargetPath();
      const n = ch.getTargetNode()?.getName();
      if (p === 'scale' || (p === 'translation' && !KEEP_TRANSLATION.has(n))) {
        const s = ch.getSampler();
        ch.dispose();
        if (s && s.listParents().filter(x => x.propertyType === 'AnimationChannel').length === 0) s.dispose();
      }
    }
  }
  // drop the mesh, keep the skeleton nodes the channels target
  for (const node of root.listNodes()) { if (node.getMesh()) node.setMesh(null); if (node.getSkin()) node.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  await doc.transform(resample({ tolerance: 4e-4 }));
  quantizeRotations(doc);
  const missing = keep.filter(k => !root.listAnimations().some(a => a.getName() === k));
  if (missing.length) console.warn('missing clips:', missing);
  await finish(doc, out, { geometry: false });
}

await animPack(UAL1, [
  'Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop',
  'Sitting_Enter', 'Sitting_Exit', 'Interact', 'PickUp_Table', 'Fixing_Kneeling', 'Idle_Torch_Loop', 'Push_Loop',
  'Death01', 'Crouch_Idle_Loop', 'Jog_Fwd_Loop', 'Hit_Chest', 'A_TPose',
], 'anims_a.glb');

await animPack(UAL2, [
  'Idle_FoldArms_Loop', 'Idle_No_Loop', 'Yes', 'Idle_TalkingPhone_Loop', 'Idle_Lantern_Loop', 'Idle_Rail_Loop',
  'Idle_Rail_Call', 'Consume', 'LayToIdle', 'Walk_Carry_Loop', 'Chest_Open', 'ClimbUp_1m',
], 'anims_b.glb');

console.log('done');
