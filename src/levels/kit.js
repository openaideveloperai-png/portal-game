// Shared building blocks for chambers: the room shell with lift cages and lights,
// observation windows, pipe runs, chamber plates and everyday dressing.
import * as THREE from 'three';
import { signTexture } from '../render/signs.js';

export const THEMES = {
  calib: { floor: 'terrazzo', wall: 'plaster_green', dado: 'tile_cream', ceiling: 'plaster_grey', light: '#fff0da' },
  calib2: { floor: 'terrazzo', wall: 'plaster_cream', dado: 'tile_green', ceiling: 'plaster_grey', light: '#fff2df' },
  calib3: { floor: 'lino_oxblood', wall: 'plaster_ochre', dado: 'tile_white', ceiling: 'plaster_grey', light: '#ffeacc' },
  archive: { floor: 'planks_dark', wall: 'plaster_cream', dado: 'veneer_oak', ceiling: 'plaster_grey', light: '#ffe2b8' },
  service: { floor: 'slab', wall: 'concrete', dado: null, ceiling: 'concrete_dark', light: '#f2f0e6' },
  wet: { floor: 'slab_dark', wall: 'concrete_dark', dado: 'tile_ox', ceiling: 'concrete_dark', light: '#e8efe9' },
};

// Build a chamber: room + entry cage + exit cage + ceiling lights + fill.
// opts: min, max, theme, entry: { wall, a, y }, exit: { wall, a, y, when, text }, open: extra openings,
//       lights: [[x,z], ...] (fluorescent troughs at ceiling height), holes, ceilHoles, label
export function shell(L, o) {
  const th = { ...THEMES[o.theme || 'calib'], ...(o.mats || {}) };
  const room = { min: o.min, max: o.max };
  const open = {};
  const add = (w, r) => { (open[w] ||= []).push(r); };
  let entry = null, exit = null;
  if (o.entry) { entry = L.cageSpot(room, o.entry.wall, o.entry.a, { y: o.entry.y }); add(entry.wall, entry.open); }
  if (o.exit) { exit = L.cageSpot(room, o.exit.wall, o.exit.a, { y: o.exit.y }); add(exit.wall, exit.open); }
  for (const [w, r] of o.open || []) add(w, r);
  L.room({ ...room, floor: th.floor, wall: th.wall, dado: th.dado, ceiling: th.ceiling, dadoH: o.dadoH ?? 1.3, open, holes: o.holes || [], ceilHoles: o.ceilHoles || [], walls: o.walls, noCeiling: o.noCeiling, inner: o.inner });
  if (entry) L.cage({ ...entry, role: 'entry', text: o.entry.text || '' });
  if (exit) L.cage({ ...exit, role: 'exit', when: o.exit.when ?? true, text: o.exit.text || 'AUDITED' });
  const y1 = o.max[1];
  for (const [x, z, opt] of o.lights || []) L.props.fluoro([x, y1 - 0.02 - (opt?.hang || 0), z], { len: 1.3, intensity: opt?.i || 46, color: th.light, shadow: !!opt?.shadow, hang: opt?.hang || 0, flicker: !!opt?.flicker });
  const c = [(o.min[0] + o.max[0]) / 2, (o.min[1] + o.max[1]) / 2 + 0.5, (o.min[2] + o.max[2]) / 2];
  const span = Math.max(o.max[0] - o.min[0], o.max[2] - o.min[2]);
  L.fill(c, { radius: span * 0.95, intensity: o.fill ?? 1.1, color: o.fillColor || '#ffe6c8' });
  L.hemi(o.sky || '#cfcfc6', o.ground || '#7d705d', o.hemi ?? 0.55);
  if (entry) L.spawn = { pos: L.cageToWorld(entry, [0, 0, -0.3]), yaw: entry.rotY + Math.PI };
  return { room, entry, exit, theme: th };
}

// Brass number plate beside a doorway / on a wall.
export function chamberPlate(L, pos, rotY, ledger, n) {
  return L.props.sign(pos, rotY, [`WEIGHING ROOM ${ledger}–${n}`], { style: 'plate', w: 0.7, h: 0.16, bg: '#b89a5a', fg: '#2a2218' });
}

// High observation window: dark wired glass with a dim lamp in the booth behind.
export function obsWindow(L, pos, rotY, { w = 2.4, h = 1.1, lit = true, npc = null } = {}) {
  const P = L.props;
  const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), L.game.engine.materials.get('wiredglass'));
  glass.position.set(pos[0] + dir.x * 0.02, pos[1], pos[2] + dir.z * 0.02); glass.rotation.y = rotY; glass.renderOrder = 2;
  L.root.add(glass);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, h + 0.6), L.game.engine.materials.plain('#16130f', { rough: 1 }));
  back.position.set(pos[0] - dir.x * 1.4, pos[1], pos[2] - dir.z * 1.4); back.rotation.y = rotY; L.root.add(back);
  const fr = 0.08;
  P.box(pos, rotY, [-w / 2 - fr, -h / 2 - fr, -0.02], [w / 2 + fr, -h / 2, 0.06], 'paint_black');
  P.box(pos, rotY, [-w / 2 - fr, h / 2, -0.02], [w / 2 + fr, h / 2 + fr, 0.06], 'paint_black');
  P.box(pos, rotY, [-w / 2 - fr, -h / 2, -0.02], [-w / 2, h / 2, 0.06], 'paint_black');
  P.box(pos, rotY, [w / 2, -h / 2, -0.02], [w / 2 + fr, h / 2, 0.06], 'paint_black');
  P.box(pos, rotY, [-w / 2 - 0.1, -h / 2 - 0.12, 0], [w / 2 + 0.1, -h / 2 - 0.08, 0.16], 'paint_black');
  if (lit) {
    const l = new THREE.PointLight('#ffcf94', 4, 4, 2);
    l.position.set(pos[0] - dir.x * 0.9, pos[1] + 0.4, pos[2] - dir.z * 0.9);
    L.addLight(l, { minor: true });
  }
  return { glass };
}

// Pipes along a ceiling line (with brackets), purely dressing.
export function ceilingPipes(L, a, b, { y, mats = ['paint_green', 'paint_cream'], gap = 0.16 } = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const nx = -dz / len, nz = dx / len;
  mats.forEach((m, i) => {
    const o = (i - (mats.length - 1) / 2) * gap;
    L.props.pipe([a[0] + nx * o, y - 0.12 - i * 0.03, a[1] + nz * o], [b[0] + nx * o, y - 0.12 - i * 0.03, b[1] + nz * o], { r: 0.045 - i * 0.008, mat: m });
  });
}

// A small operator's desk in a corner: desk, chair, lamp, papers.
export function operatorDesk(L, pos, rotY, seed = 1) {
  L.props.desk(pos, rotY, { seed });
  L.props.chair(L.props.localToWorld(pos, rotY, [0.1, 0, 0.7]), rotY + Math.PI + 0.3);
}

export function sign(L, pos, rotY, lines, opts = {}) { return L.props.sign(pos, rotY, lines, opts); }
export { signTexture };
