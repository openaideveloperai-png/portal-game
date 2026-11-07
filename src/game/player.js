// First-person player: Rapier kinematic character controller, mouse look, weight-driven
// gravity (including inverted gravity for negative weight), platform riding, pushing
// objects, pressing on whatever is underfoot, footsteps and landing feedback.
import * as THREE from 'three';
import { R, GROUPS } from '../core/physics.js';
import { clamp, damp, lerp } from '../core/util.js';
import { audio } from '../core/audio.js';

export const G = 9.81;
export const UNIT_MASS = 20;         // kg of "pull" per measure (see weights.js)
const RADIUS = 0.3, HALF = 0.6;      // capsule: 1.8 m tall
const EYE = 0.72;                    // eye height above capsule centre
const WALK = 4.3;
const JUMP_V = 4.75;                 // m/s, same legs at every weight
const UP = new THREE.Vector3(0, 1, 0);

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class Player {
  constructor(game) {
    this.game = game;
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.flip = new THREE.Quaternion();        // current gravity frame (animated)
    this.flipTarget = new THREE.Quaternion();
    this.weight = 2;
    this.grounded = false;
    this.groundCollider = null;
    this.groundInfo = null;
    this.coyote = 0; this.jumpBuffer = 0;
    this.stride = 0; this.bob = 0; this.landDip = 0;
    this.extAccel = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.renderPos = new THREE.Vector3();
    this.frozen = false;
    this.noclip = false;
    this.inBooth = null;
    this.lastSafe = null;
    this.stepCooldown = 0;
  }

  // Called when a level loads: creates body/collider/controller in the new world.
  attach(phys, spawn) {
    this.phys = phys;
    const w = phys.world;
    this.body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.pos[0], spawn.pos[1] + HALF + RADIUS + 0.02, spawn.pos[2]));
    this.collider = w.createCollider(R.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(GROUPS.player).setFriction(0), this.body);
    phys.tag(this.collider, { kind: 'player', player: this });
    this.cc = w.createCharacterController(0.02);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.cc.setMinSlopeSlideAngle(40 * Math.PI / 180);
    this.cc.enableAutostep(0.36, 0.22, false);
    this.cc.enableSnapToGround(0.28);
    this.cc.setApplyImpulsesToDynamicBodies(false);
    this.cc.setSlideEnabled(true);
    this.setWeight(spawn.weight ?? 2, true);
    this.yaw = spawn.yaw ?? 0; this.pitch = 0;
    this.vel.set(0, 0, 0);
    const t = this.body.translation();
    this.pos.set(t.x, t.y, t.z); this.prevPos.copy(this.pos); this.renderPos.copy(this.pos);
    this.lastSafe = { pos: [...spawn.pos], yaw: this.yaw };
  }

  detach() { this.riding = null; this.ridePrev = null; this.rideOffset = 0; this.body = null; this.collider = null; this.cc = null; this.phys = null; this.groundCollider = null; this.groundInfo = null; this.grounded = false; }

  get up() { return _w.set(0, 1, 0).applyQuaternion(this.flipTarget); }
  get inverted() { return this.weight < 0; }

  setWeight(w, instant = false) {
    const wasInv = this.weight < 0;
    this.weight = w;
    const inv = w < 0;
    if (inv !== wasInv || instant) {
      if (inv) {
        // roll 180° about the current horizontal look direction
        const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).applyQuaternion(this.flip);
        fwd.y = 0; fwd.normalize();
        this.flipTarget.setFromAxisAngle(fwd.lengthSq() > 0 ? fwd : new THREE.Vector3(1, 0, 0), Math.PI);
        if (!instant) audio.play('cloth', { gain: 1 });
      } else {
        if (wasInv && !instant) {
          // keep facing the same world direction after the roll back
          const f = this.forwardWorld(new THREE.Vector3()); f.y = 0;
          this.yaw = Math.atan2(-f.x, -f.z);
        }
        this.flipTarget.identity();
      }
      if (instant) this.flip.copy(this.flipTarget);
      if (this.cc) { const u = this.up; this.cc.setUp({ x: 0, y: Math.sign(u.y) || 1, z: 0 }); }
      if (!instant && inv !== wasInv) this.vel.multiplyScalar(0.3);
    }
  }

  // Gravity acceleration magnitude along -up for current weight (+ carried load).
  gravityFor(w) { return G * Math.abs(w) / 2; }

  forwardWorld(out) { // look direction in world space
    _e.set(this.pitch, this.yaw, 0, 'YXZ'); _q.setFromEuler(_e);
    return out.set(0, 0, -1).applyQuaternion(_q).applyQuaternion(this.flip);
  }

  eye(out) { return out.copy(this.renderPos).addScaledVector(this.up, EYE + this.bob - this.landDip); }
  eyeNow(out) { return out.copy(this.pos).addScaledVector(this.up, EYE); }
  feet(out) { return out.copy(this.pos).addScaledVector(this.up, -(HALF + RADIUS)); }

  teleport(pos, yaw = null) {
    if (!this.body) return;
    const p = { x: pos[0], y: pos[1] + (this.weight < 0 ? -(HALF + RADIUS + 0.02) : HALF + RADIUS + 0.02), z: pos[2] };
    this.body.setTranslation(p, true);
    this.body.setNextKinematicTranslation(p);
    this.pos.set(p.x, p.y, p.z); this.prevPos.copy(this.pos); this.renderPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    if (yaw !== null) { this.yaw = yaw; this.pitch = 0; }
  }

  look(dx, dy) {
    this.yaw -= dx; this.pitch = clamp(this.pitch - dy, -1.5, 1.5);
  }

  fixedUpdate(dt, input) {
    if (!this.body || this.frozen) { this.prevPos.copy(this.pos); return; }
    this.prevPos.copy(this.pos);
    const game = this.game;
    const carried = game.tare?.held?.weight ?? 0;
    const wEff = this.weight + (game.tare?.held ? carried : 0);
    const upv = this.up.clone();
    const sgn = Math.sign(upv.y) || 1;

    // --- desired horizontal velocity in the player's own frame
    let fx = 0, fz = 0;
    if (input.isDown('KeyW')) fz -= 1;
    if (input.isDown('KeyS')) fz += 1;
    if (input.isDown('KeyA')) fx -= 1;
    if (input.isDown('KeyD')) fx += 1;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const speedK = this.weight >= 4 ? 0.76 : this.weight === 3 ? 0.88 : this.weight === 0 ? 0.7 : 1;
    const speed = WALK * speedK * (game.tare?.held && carried >= 2 ? 0.88 : 1);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const wishLocal = new THREE.Vector3(fx * cy + fz * sy, 0, -fx * sy + fz * cy).multiplyScalar(speed);
    const wish = wishLocal.applyQuaternion(this.flipTarget);

    // split current velocity into vertical (along up) and horizontal
    const vUp = this.vel.dot(upv);
    const hor = this.vel.clone().addScaledVector(upv, -vUp);
    if (this.grounded) {
      const dv = wish.clone().sub(hor);
      const maxDv = 55 * dt;
      if (dv.length() > maxDv) dv.setLength(maxDv);
      hor.add(dv);
    } else if (wish.lengthSq() > 0.01) {
      // air control: steer, but never brake a launch or a fall
      const wd = wish.clone().normalize();
      const along = hor.dot(wd);
      const add = Math.max(0, Math.min((this.weight === 0 ? 6 : 14) * dt, wish.length() - along));
      hor.addScaledVector(wd, add);
    }

    // --- vertical
    let vy = vUp;
    const g = this.gravityFor(wEff);
    if (wEff !== 0) vy -= g * dt * (Math.sign(wEff) === sgn ? 1 : -1);
    else vy *= Math.exp(-1.2 * dt);
    // external acceleration (vents), along world axes
    vy += this.extAccel.dot(upv) * dt;
    hor.addScaledVector(this.extAccel.clone().addScaledVector(upv, -this.extAccel.dot(upv)), dt);
    this.extAccel.set(0, 0, 0);
    vy = clamp(vy, -30, this.inVent ? 5 : 30);

    if (this.grounded) this.coyote = 0.12; else this.coyote -= dt;
    if (input.wasPressed('Space')) this.jumpBuffer = 0.14; else this.jumpBuffer -= dt;
    if (this.jumpBuffer > 0 && this.coyote > 0 && this.weight !== 0) {
      vy = JUMP_V;
      this.coyote = 0; this.jumpBuffer = 0; this.grounded = false;
      audio.play('cloth', { gain: 0.6 });
    } else if (this.jumpBuffer > 0 && this.weight === 0) {
      vy = 1.2; this.jumpBuffer = 0;
    }

    // Platform carry. Kinematic platforms (lifts, doors) report their velocity.
    // A weighted crate under us is "ridden": we integrate the crate + rider system
    // ourselves (combined weight decides up or down) and follow its exact displacement.
    const plat = new THREE.Vector3();
    const platDisp = new THREE.Vector3();
    let rideOwner = null;
    let vUpOverride = false;
    if (this.grounded && this.groundCollider) {
      const pb = this.groundCollider.parent();
      const info = this.phys.infoOf(this.groundCollider);
      if (pb && pb.isKinematic()) {
        const lv = pb.linvel(); plat.set(lv.x, lv.y, lv.z);
      } else if (pb && pb.isDynamic() && info?.owner?.weighted && !info.owner.held) rideOwner = info.owner;
    }
    // stay on a crate we're riding even if the controller momentarily loses contact
    if (!rideOwner && this.riding && this.riding.body && !this.riding.held && this.jumpBuffer <= 0) {
      const t = this.riding.body.translation();
      const feetY = this.pos.y - (HALF + RADIUS) * sgn;
      const gap = (feetY - (t.y + this.rideOffset)) * sgn;
      const half = (this.riding.size || 0.7) / 2 + 0.25;
      if (gap > -0.06 && gap < 0.12 && Math.abs(this.pos.x - t.x) < half && Math.abs(this.pos.z - t.z) < half) {
        rideOwner = this.riding;
        this.grounded = true;
        this.groundCollider = this.riding.collider;
      }
    }
    if (this.riding && this.riding !== rideOwner) {
      this.riding.ridden = false;
      if (!this.riding.held && this.riding.collider) this.riding.collider.setCollisionGroups(GROUPS.dynamic);
      this.riding.applyGravity(); this.riding = null;
    }
    if (rideOwner) {
      const b = rideOwner.body;
      const t = b.translation();
      const feetY = this.pos.y - (HALF + RADIUS) * sgn;
      if (this.riding !== rideOwner) {
        this.riding = rideOwner; rideOwner.ridden = true; rideOwner.applyGravity(); this.rideOffset = feetY - t.y;
        rideOwner.collider.setCollisionGroups(GROUPS.ridden);
      }
      const lv = b.linvel();
      const aUp = -(G / 2) * (rideOwner.weight + wEff);
      const vy = Math.max(-12, Math.min(3.2, lv.y + aUp * dt));
      const hd = rideOwner.inBrine ? 0.995 : 0.85;
      const vx = lv.x * hd, vz = lv.z * hd;
      b.setLinvel({ x: vx, y: vy, z: vz }, true);
      b.setAngvel({ x: 0, y: b.angvel().y * 0.9, z: 0 }, true);
      // lead: put our feet where the crate's top will be after this step
      platDisp.set(vx * dt, (t.y + vy * dt + this.rideOffset) - feetY, vz * dt);
      if (vy > 0) vUpOverride = true;
    }

    if (rideOwner && vy <= 0) vy = 0;   // standing on a ridden crate: it carries us vertically
    const vel = hor.clone().addScaledVector(upv, vy);
    const move = vel.clone().multiplyScalar(dt).addScaledVector(plat, dt).add(platDisp);

    if (this.noclip) {
      const f = this.forwardWorld(new THREE.Vector3());
      const nm = f.multiplyScalar(-fz * 8 * dt).add(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(fx * 8 * dt));
      if (input.isDown('Space')) nm.y += 6 * dt;
      this.pos.add(nm);
      this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
      this.vel.set(0, 0, 0);
      return;
    }

    const held = game.tare?.held;
    const heldBody = held?.body;
    const filter = c => {
      const b = c.parent();
      if (heldBody && b && b.handle === heldBody.handle) return false;
      return true;
    };
    // snap only when not moving away from the ground
    this.cc.enableSnapToGround(vy > 0.5 || vUpOverride ? 0.0 : 0.28);
    this.cc.computeColliderMovement(this.collider, { x: move.x, y: move.y, z: move.z }, R.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.kcc, filter);
    const m = this.cc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded();

    // inspect collisions: ground collider, ceiling hits, pushing bodies
    this.groundCollider = null;
    let hitCeil = false;
    const n = this.cc.numComputedCollisions();
    for (let i = 0; i < n; i++) {
      const c = this.cc.computedCollision(i);
      if (!c || !c.collider) continue;
      const ny = c.normal1.y * sgn;
      if (ny > 0.55) { if (!this.groundCollider) this.groundCollider = c.collider; }
      else if (ny < -0.55) hitCeil = true;
      else {
        const b = c.collider.parent();
        if (b && b.isDynamic()) {
          // push: scaled by how hard we walk into it, divided by its weight
          const info = this.phys.infoOf(c.collider);
          const ow = Math.max(0.5, info?.owner?.weight ?? 2);
          const push = new THREE.Vector3(-c.normal1.x, 0, -c.normal1.z);
          const into = Math.max(0, hor.dot(push));
          if (into > 0.2) b.applyImpulse({ x: push.x * into * 9 / ow, y: 0, z: push.z * into * 9 / ow }, true);
        }
      }
    }
    // if we're standing on something, find it even when the controller didn't report it
    if (this.grounded && !this.groundCollider) this.groundCollider = this.probeGround();
    this.groundInfo = this.groundCollider ? this.phys.infoOf(this.groundCollider) : null;

    // if we were stopped (a ceiling over our head), the crate under us stops too
    if (rideOwner && this.riding === rideOwner) {
      const want = platDisp.y, got = m.y;
      if (want > 0 && got < want - 0.002) {
        const lv = rideOwner.body.linvel();
        rideOwner.body.setLinvel({ x: lv.x, y: Math.max(0, got) / dt, z: lv.z }, true);
      }
    }
    const np = this.body.translation();
    const next = { x: np.x + m.x, y: np.y + m.y, z: np.z + m.z };
    this.body.setNextKinematicTranslation(next);
    this.pos.set(next.x, next.y, next.z);

    if (this.grounded && vy * 1 < 0) vy = 0;
    if (hitCeil && vy > 0) vy = 0;
    // horizontal velocity limited by what actually happened (stops wall sliding build-up)
    const realH = new THREE.Vector3(m.x, m.y, m.z).sub(plat.clone().multiplyScalar(dt)).divideScalar(dt);
    realH.addScaledVector(upv, -realH.dot(upv));
    if (realH.length() < hor.length()) hor.copy(realH);
    this.vel.copy(hor).addScaledVector(upv, vy);

    // press down on whatever dynamic body we stand on (a ridden crate is handled above)
    if (this.grounded && this.groundCollider && !this.riding) {
      const gb = this.groundCollider.parent();
      if (gb && gb.isDynamic() && wEff !== 0) {
        const imp = UNIT_MASS * G * wEff / 2 * dt;
        gb.applyImpulse({ x: 0, y: -imp * sgn, z: 0 }, true);
      }
    }

    // landing feedback
    if (this.grounded && !wasGrounded) {
      const impact = -this.lastVy;
      if (impact > 3.5) {
        this.landDip = Math.min(0.12, impact * 0.012);
        audio.play('land', { surface: this.groundInfo?.surface || 'stone', gain: Math.min(1.4, impact / 7), heavy: Math.max(0.6, this.weight / 2) });
      }
    }
    this.lastVy = vy;

    // footsteps
    const hs = hor.length();
    if (this.grounded && hs > 0.5) {
      this.stride += hs * dt;
      if (this.stride > 1.75) {
        this.stride = 0;
        audio.play('footstep', { surface: this.groundInfo?.surface || 'stone', gain: 0.75, heavy: Math.max(0.6, wEff / 2) });
      }
    }

    // remember last safe standing place for respawns
    if (this.grounded && this.groundInfo && this.groundInfo.kind === 'static' && !this.groundInfo.unsafe) {
      this.safeT = (this.safeT || 0) + dt;
      if (this.safeT > 0.5) { this.safeT = 0; const f = this.feet(new THREE.Vector3()); this.lastSafe = { pos: [f.x, f.y, f.z], yaw: this.yaw, weight: this.weight }; }
    }
  }

  probeGround() {
    const upv = this.up;
    const from = this.pos.clone().addScaledVector(upv, -(HALF));
    const hit = this.phys.raycast(from, upv.clone().negate(), RADIUS + 0.12, { filter: GROUPS.kcc, exclude: this.collider });
    return hit ? hit.collider : null;
  }

  frameUpdate(dt, alpha, input) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
    // animate gravity frame
    if (!this.flip.equals(this.flipTarget)) {
      this.flip.rotateTowards(this.flipTarget, dt * 4.2);
    }
    // head bob
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const bobOn = this.game.settings.headBob !== false;
    if (bobOn && this.grounded && hs > 0.5) this.bob = Math.sin(this.stride / 1.75 * Math.PI * 2) * 0.022 * Math.min(1, hs / WALK);
    else this.bob = damp(this.bob, 0, 10, dt);
    this.landDip = damp(this.landDip, 0, 7, dt);
  }

  applyCamera(cam) {
    this.eye(cam.position);
    _e.set(this.pitch, this.yaw, 0, 'YXZ');
    _q.setFromEuler(_e);
    cam.quaternion.copy(this.flip).multiply(_q);
    if (this.game.settings.headBob !== false) {
      const roll = Math.sin(this.stride / 1.75 * Math.PI) * 0.004;
      cam.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    }
  }
}
