// Test room with one of everything (used by the automated tests, not in the campaign).
export default {
  id: 'sandbox', ledger: 'T', chamber: 0, title: 'Sandbox',
  tare: { enabled: true, capacity: 3, debt: true },
  build(L) {
    L.spawn = { pos: [0, 0, 8], yaw: 0 };
    L.room({ min: [-10, 0, -10], max: [10, 6, 10], floor: 'terrazzo', wall: 'plaster_green', dado: 'tile_cream', ceiling: 'plaster_grey',
      open: { 'z-': [[-0.8, 0.8, 0, 2.5]] } });
    L.hemi();
    L.props.fluoro([0, 5.95, 0], { len: 1.4, shadow: true });
    L.props.fluoro([-6, 5.95, -5], { len: 1.4 });
    L.props.fluoro([6, 5.95, 5], { len: 1.4 });
    L.props.pendant([-6, 4.8, 6]);
    L.crate({ pos: [-2, 0, 4], weight: 1 });
    L.crate({ pos: [2, 0, 4], weight: 2 });
    L.crate({ pos: [4, 0, 2], weight: 3 });
    L.anchor({ pos: [-6, 0, 0], weight: 4 });
    const p = L.plate({ pos: [0, 0, 0], need: 3 });
    L.door({ pos: [0, 0, -10], rotY: 0, w: 1.6, h: 2.5, when: p });
    L.wire({ from: p, points: [[0, 0.6], [0, -9.6]] });
    L.vent({ pos: [7, 0, -6], height: 5 });
    L.booth({ pos: [-8, 0, 7], rotY: Math.PI / 2, range: [-2, 4] });
    L.props.desk([6, 0, 7], -Math.PI / 2);
    L.props.chair([5.2, 0, 7], Math.PI / 2);
    L.props.shelf([-9.5, 0, -6], Math.PI / 2, { w: 2.4 });
    L.props.radiator([3, 0, 9.8], Math.PI);
    L.props.clock([0, 4.2, 9.98], Math.PI);
    L.props.sign([-3, 2.2, 9.98], Math.PI, ['WEIGHING ROOM 3'], {});
    L.props.poster([4, 2.0, -9.98], 0, 'measure');
    L.npc({ name: 'brask', pos: [-2, 0, -3], yaw: 0.3, anim: 'Idle_Talking_Loop', spec: { body: 'm', skin: 'light', outfit: 'brask', hair: 'parted', beard: true, hairColor: '#aaa49a', grey: 0.85, belly: 0.05, posture: 0.08, age: 1 } });
    L.npc({ name: 'varga', pos: [2.4, 0, -3], yaw: -0.3, anim: 'Idle_FoldArms_Loop', spec: { body: 'f', skin: 'light', outfit: 'varga', hair: 'parted', hairColor: '#bdb8ae', grey: 0.95, glasses: true, posture: 0.05, age: 1 } });
    L.mannequin({ pos: [-5, 0, -8], yaw: 0.2, pose: 'stand' });
    L.mannequin({ pos: [-4, 0, -8], yaw: -0.1, pose: 'fold', female: true });
    L.mannequin({ pos: [-3, 0, -8.2], yaw: 0.0, pose: 'stand2' });
    L.ambience = { room: 0.6, drips: 0.4, creaks: 0.2, every: 4 };
  },
};
