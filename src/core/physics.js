// Thin wrapper around Rapier: one world per level, collision groups, helpers for
// creating bodies, raycasts, and contact queries used by the weight system.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export let R = null;
export async function initPhysics() {
  if (R) return R;
  await RAPIER.init();
  R = RAPIER;
  return R;
}

// Membership bits.
export const G = {
  STATIC: 1 << 0,
  DYNAMIC: 1 << 1,
  PLAYER: 1 << 2,
  HELD: 1 << 3,
  DEBRIS: 1 << 4,
  CRATE_ONLY: 1 << 5,   // blocks objects but lets people through (turnstiles, ballast screens)
  PLAYER_ONLY: 1 << 6,  // blocks people but lets objects through (clips, chute guards)
  RAY_ONLY: 1 << 7,     // only hit by aim rays (dials on booths, wall-mounted gauges)
  RAIL: 1 << 8,         // railings: stop people and objects, let the aim ray through
  KCC: 1 << 9,          // membership used only by the character controller's queries
};
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const GROUPS = {
  // The character controller queries through the KCC membership. The capsule itself
  // still touches crates in the solver; the controller leads platform motion so a
  // crate rising under you carries you rather than jamming (see Player).
  static: groups(G.STATIC, G.DYNAMIC | G.PLAYER | G.HELD | G.DEBRIS | G.KCC),
  dynamic: groups(G.DYNAMIC, G.STATIC | G.DYNAMIC | G.PLAYER | G.HELD | G.CRATE_ONLY | G.DEBRIS | G.RAIL | G.KCC),
  held: groups(G.HELD, G.STATIC | G.DYNAMIC | G.CRATE_ONLY | G.RAIL),
  ridden: groups(G.DYNAMIC, G.STATIC | G.DYNAMIC | G.HELD | G.CRATE_ONLY | G.DEBRIS | G.RAIL | G.KCC),
  player: groups(G.PLAYER, G.STATIC | G.DYNAMIC | G.PLAYER_ONLY | G.RAIL),
  kcc: groups(G.KCC, G.STATIC | G.DYNAMIC | G.PLAYER_ONLY | G.RAIL),
  rail: groups(G.RAIL, G.DYNAMIC | G.PLAYER | G.HELD | G.KCC),
  crateOnly: groups(G.CRATE_ONLY, G.DYNAMIC | G.HELD),
  playerOnly: groups(G.PLAYER_ONLY, G.PLAYER | G.KCC),
  debris: groups(G.DEBRIS, G.STATIC | G.DYNAMIC),
  rayOnly: groups(G.RAY_ONLY, G.RAY_ONLY),
  // query filters
  aim: groups(0xffff, G.STATIC | G.DYNAMIC | G.HELD | G.RAY_ONLY | G.PLAYER_ONLY),
  sight: groups(0xffff, G.STATIC | G.DYNAMIC),
};

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class PhysicsWorld {
  static RAIL_GROUP = GROUPS.rail;
  constructor() {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.integrationParameters.numSolverIterations = 8;
    this.events = new R.EventQueue(true);
    this.info = new Map();      // collider handle -> info object (owner, material, ...)
    this.onImpact = null;       // (info, magnitude, point) => void
  }

  dispose() {
    try { this.events.free(); } catch (e) { /* ignore */ }
    try { this.world.free(); } catch (e) { /* ignore */ }
    this.info.clear();
  }

  tag(collider, info) { this.info.set(collider.handle, info); return collider; }
  infoOf(collider) { return collider ? this.info.get(collider.handle) : undefined; }

  // ---------------------------------------------------------------- creation helpers
  fixedBox(center, half, { rot = null, info = null, group = GROUPS.static, friction = 0.8 } = {}) {
    const desc = R.ColliderDesc.cuboid(half[0], half[1], half[2])
      .setTranslation(center[0], center[1], center[2])
      .setCollisionGroups(group).setFriction(friction);
    if (rot) desc.setRotation(rot);
    const c = this.world.createCollider(desc);
    if (info) this.tag(c, info);
    return c;
  }

  fixedCollider(desc, info, group = GROUPS.static) {
    desc.setCollisionGroups(group);
    const c = this.world.createCollider(desc);
    if (info) this.tag(c, info);
    return c;
  }

  kinematicBody(pos, rot = null) {
    const d = R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1], pos[2]);
    if (rot) d.setRotation(rot);
    return this.world.createRigidBody(d);
  }

  dynamicBody(pos, { rot = null, linDamp = 0.05, angDamp = 0.4, ccd = false, mass = null } = {}) {
    const d = R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2])
      .setLinearDamping(linDamp).setAngularDamping(angDamp).setCcdEnabled(ccd);
    if (rot) d.setRotation(rot);
    const b = this.world.createRigidBody(d);
    return b;
  }

  attach(desc, body, info, group = GROUPS.dynamic) {
    desc.setCollisionGroups(group);
    const c = this.world.createCollider(desc, body);
    if (info) this.tag(c, info);
    return c;
  }

  remove(collider) {
    if (!collider) return;
    this.info.delete(collider.handle);
    try { this.world.removeCollider(collider, true); } catch (e) { /* ignore */ }
  }
  removeBody(body) {
    if (!body) return;
    const n = body.numColliders();
    for (let i = 0; i < n; i++) this.info.delete(body.collider(i).handle);
    try { this.world.removeRigidBody(body); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- stepping
  step() {
    this.world.step(this.events);
    if (this.onImpact) {
      this.events.drainContactForceEvents(ev => {
        const c1 = this.world.getCollider(ev.collider1());
        const c2 = this.world.getCollider(ev.collider2());
        const mag = ev.maxForceMagnitude();
        const i1 = this.infoOf(c1), i2 = this.infoOf(c2);
        const src = (i1 && i1.impactSound) ? i1 : i2;
        if (src && src.impactSound) {
          const body = (src === i1 ? c1 : c2)?.parent();
          const p = body ? body.translation() : null;
          this.onImpact(src, mag, p, src === i1 ? i2 : i1);
        }
      });
    } else this.events.clear();
    this.events.drainCollisionEvents(() => {});
  }

  // ---------------------------------------------------------------- queries
  raycast(origin, dir, maxDist, { filter = GROUPS.aim, exclude = null, excludeBody = null, solid = true, predicate = null } = {}) {
    const ray = new R.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.world.castRayAndGetNormal(ray, maxDist, solid, R.QueryFilterFlags.EXCLUDE_SENSORS, filter, exclude, excludeBody, predicate);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return {
      collider: hit.collider,
      info: this.infoOf(hit.collider),
      point: new THREE.Vector3(p.x, p.y, p.z),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      dist: hit.timeOfImpact,
    };
  }

  // Colliders overlapping an axis-aligned box (used by vents, brine, triggers, doors).
  overlapBox(center, half, filter = groups(0xffff, G.DYNAMIC | G.HELD | G.PLAYER), rot = null) {
    const shape = new R.Cuboid(half[0], half[1], half[2]);
    const out = [];
    const r = rot || { x: 0, y: 0, z: 0, w: 1 };
    this.world.intersectionsWithShape({ x: center[0], y: center[1], z: center[2] }, r, shape, c => { out.push(c); return true; }, R.QueryFilterFlags.EXCLUDE_SENSORS, filter);
    return out;
  }

  // For every collider currently in contact with `col`, call fn(other, upness) where
  // upness = dot(normal from col to other, +Y). Positive => other sits on top of col.
  contactsOf(col, fn) {
    this.world.contactPairsWith(col, other => {
      let best = null;
      this.world.contactPair(col, other, (m, flipped) => {
        const n = m.numContacts();
        if (n === 0) return;
        let minDist = Infinity;
        for (let i = 0; i < n; i++) minDist = Math.min(minDist, m.contactDist(i));
        if (minDist > 0.03) return;
        const nn = m.normal();
        const up = flipped ? -nn.y : nn.y;
        if (best === null || Math.abs(up) > Math.abs(best)) best = up;
      });
      if (best !== null) fn(other, best);
    });
  }
}

// three <-> rapier conversions
export const vecR = v => ({ x: v.x, y: v.y, z: v.z });
export const quatR = q => ({ x: q.x, y: q.y, z: q.z, w: q.w });
export function syncObject(obj, body) {
  const t = body.translation(); const r = body.rotation();
  obj.position.set(t.x, t.y, t.z);
  obj.quaternion.set(r.x, r.y, r.z, r.w);
}
export { _v, _q };
