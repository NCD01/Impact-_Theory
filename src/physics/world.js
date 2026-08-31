/**
 * world.js
 *
 * OWNS: the Rapier world, the creation and removal of every rigid body in the game, the
 * fixed timestep loop, and the conversion of Rapier contact events into impact energy
 * in joules.
 *
 * MUST NOT OWN: what an impact means. This file reports "these two things hit each
 * other with this much energy". Deciding that the energy damages a piece, spawns
 * fragments, shakes the camera or plays a sound belongs to src/physics/damage.js and
 * the game layer.
 *
 * Units throughout are Structural Units, seconds, kilograms and joules. 1 SU is 1 metre.
 *
 * The impact energy model, which is the reason this file is not trivial.
 * A hit counter cannot tell a graze from a square hit, so damage here is driven by
 * kinetic energy. Rapier reports contact forces during a step, but by the time the
 * event is read the velocities have already been changed by the very impulse being
 * measured. So each body's velocity is cached immediately before the step, and the
 * energy is computed from those pre-step velocities:
 *
 *     v_rel = (v1 - v2) projected onto the contact normal
 *     mu    = m1 * m2 / (m1 + m2)          reduced mass, or just m for a fixed body
 *     E     = 0.5 * mu * v_rel^2
 *
 * That is the energy actually available to be absorbed in the collision, which is the
 * quantity a material's toughness should be measured against.
 *
 * API facts here were read from node_modules/@dimforge/rapier3d/rapier.d.ts at
 * version 0.20.0, not recalled: init() must be awaited before any other call,
 * world.step(eventQueue) drives the simulation, and contact force events are only
 * delivered for colliders that opt in with setActiveEvents and a force threshold.
 */

import * as RAPIER from '@dimforge/rapier3d';
import { WORLD } from '../core/constants.js';

/** Contact force below which Rapier does not raise an event, newtons. Resting stacks
 *  press on each other constantly; without a floor the event queue fills with the
 *  weight of the structure standing still. */
const CONTACT_FORCE_EVENT_THRESHOLD_N = 60;

let rapierReady = null;

/**
 * Loads and initialises the Rapier WebAssembly module.
 *
 * Must be awaited before createPhysicsWorld. Safe to call more than once; the same
 * promise is returned, so several callers cannot start two initialisations.
 *
 * @returns {Promise<typeof RAPIER>}
 */
export function initPhysics() {
  // The non-compat build initialises its WebAssembly through the bundler at module load
  // rather than through an init() call, so there is nothing to await. The promise is
  // kept so callers do not have to care which build is in use.
  if (!rapierReady) rapierReady = Promise.resolve(RAPIER);
  return rapierReady;
}

/**
 * Creates a physics world with a ground plane.
 *
 * Assumes initPhysics() has resolved. The returned object owns every body it creates;
 * callers hold the opaque handles it returns and never touch Rapier directly.
 *
 * @returns {PhysicsWorld}
 */
export function createPhysicsWorld() {
  const world = new RAPIER.World({ x: 0, y: WORLD.GRAVITY_Y, z: 0 });
  world.integrationParameters.numSolverIterations = WORLD.SOLVER_ITERATIONS;
  world.timestep = WORLD.FIXED_TIMESTEP;

  const eventQueue = new RAPIER.EventQueue(true);

  /** Every body this world created, by its Rapier handle. @type {Map<number, BodyRecord>} */
  const bodies = new Map();
  /** Collider handle to body handle, so a contact event can find its owners. */
  const colliderToBody = new Map();
  /** Pre-step linear velocities, keyed by body handle. Rebuilt every step. */
  const prevVelocity = new Map();

  /** Leftover real time not yet consumed by a fixed step, seconds. */
  let accumulator = 0;

  // The ground. A fixed cuboid rather than a true half space, because a half space
  // extends infinitely and makes the debug view harder to read for no gain here.
  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
  );
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc
      .cuboid(WORLD.GROUND_HALF_EXTENT, 0.5, WORLD.GROUND_HALF_EXTENT)
      .setFriction(0.9)
      .setRestitution(0.05),
    groundBody,
  );
  colliderToBody.set(groundCollider.handle, null);

  /**
   * @typedef {object} BodyRecord
   * @property {import('@dimforge/rapier3d').RigidBody} body
   * @property {string} kind      'piece', 'ball' or 'fragment'.
   * @property {object} userData  Whatever the game layer attached.
   * @property {number} mass
   */

  /**
   * Builds the Rapier collider descriptions for one of our collider descriptions.
   *
   * Assumes `desc` came from colliderFor() in src/blocks/colliders.js. Returns an array
   * because a compound piece needs one Rapier collider per part. Every returned
   * description is already offset for the piece's pivot, so the caller positions the
   * body at the piece's authored origin and the shapes land in the right place.
   *
   * @param {object} desc
   * @param {number} scale Uniform scale, used for fragments. 1 for a whole piece.
   * @returns {import('@dimforge/rapier3d').ColliderDesc[]}
   */
  function buildColliderDescs(desc, scale = 1) {
    const lift = desc.pivotLift * scale;
    if (desc.kind === 'cuboid') {
      const h = desc.halfExtents;
      return [
        RAPIER.ColliderDesc.cuboid(h.x * scale, h.y * scale, h.z * scale)
          .setTranslation(0, lift, 0),
      ];
    }
    if (desc.kind === 'cylinder') {
      const c = RAPIER.ColliderDesc.cylinder(desc.halfHeight * scale, desc.radius * scale);
      if (desc.axis === 'x') {
        // Rapier cylinders are Y aligned. The roller lies on its side, so the collider
        // is rotated a quarter turn about Z. Quaternion for 90 degrees about Z.
        const s = Math.SQRT1_2;
        c.setRotation({ x: 0, y: 0, z: s, w: s });
      }
      return [c.setTranslation(0, lift, 0)];
    }
    return desc.parts.map((p) => RAPIER.ColliderDesc
      .cuboid(p.half.x * scale, p.half.y * scale, p.half.z * scale)
      .setTranslation(p.offset.x * scale, lift + p.offset.y * scale, p.offset.z * scale));
  }

  /**
   * Adds a rigid body built from a collider description and a material family.
   *
   * Assumes `position` is where the piece's authored origin goes, in SU, and that the
   * pivot handling in buildColliderDescs puts the shape in the right place relative to
   * it. Returns a handle the caller uses for everything afterwards.
   *
   * @param {object} opts
   * @param {object} opts.collider   From colliderFor().
   * @param {object} opts.family     From getFamily().
   * @param {{x:number,y:number,z:number}} opts.position
   * @param {{x:number,y:number,z:number,w:number}} [opts.rotation]
   * @param {boolean} [opts.fixed]   True for a piece that never moves.
   * @param {number} [opts.scale]    Uniform scale, for fragments.
   * @param {string} [opts.kind]     'piece', 'ball' or 'fragment'.
   * @param {object} [opts.userData]
   * @returns {number} The Rapier body handle.
   */
  function addBody({
    collider, family, position, rotation, fixed = false, scale = 1,
    kind = 'piece', userData = {},
  }) {
    const bodyDesc = fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    bodyDesc.setTranslation(position.x, position.y, position.z);
    if (rotation) bodyDesc.setRotation(rotation);
    bodyDesc
      .setLinearDamping(0.06)
      .setAngularDamping(0.12)
      .setCanSleep(true);
    const body = world.createRigidBody(bodyDesc);

    for (const cd of buildColliderDescs(collider, scale)) {
      cd.setDensity(family.density)
        .setFriction(family.friction)
        .setRestitution(family.restitution)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(CONTACT_FORCE_EVENT_THRESHOLD_N);
      const c = world.createCollider(cd, body);
      colliderToBody.set(c.handle, body.handle);
    }

    bodies.set(body.handle, { body, kind, userData, mass: body.mass() });
    return body.handle;
  }

  /**
   * Adds a ball. Continuous collision detection is on, because a fast small sphere can
   * pass through a 1 SU block in a single 60 Hz step without it.
   *
   * @param {object} opts
   * @param {{x:number,y:number,z:number}} opts.position
   * @param {{x:number,y:number,z:number}} opts.velocity
   * @param {number} opts.radius
   * @param {number} opts.density
   * @param {number} opts.restitution
   * @param {number} opts.friction
   * @param {object} [opts.userData]
   * @returns {number} The Rapier body handle.
   */
  function addBall({
    position, velocity, radius, density, restitution, friction, userData = {},
  }) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinvel(velocity.x, velocity.y, velocity.z)
        .setCcdEnabled(true)
        .setLinearDamping(0.01)
        .setAngularDamping(0.05),
    );
    const c = world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setDensity(density)
        .setRestitution(restitution)
        .setFriction(friction)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(CONTACT_FORCE_EVENT_THRESHOLD_N),
      body,
    );
    colliderToBody.set(c.handle, body.handle);
    bodies.set(body.handle, { body, kind: 'ball', userData, mass: body.mass() });
    return body.handle;
  }

  /**
   * Removes a body and its colliders. Safe to call with a handle that is already gone,
   * which happens when a piece is destroyed in the same frame its ball expires.
   *
   * @param {number} handle
   */
  function removeBody(handle) {
    const rec = bodies.get(handle);
    if (!rec) return;
    for (let i = 0; i < rec.body.numColliders(); i += 1) {
      colliderToBody.delete(rec.body.collider(i).handle);
    }
    world.removeRigidBody(rec.body);
    bodies.delete(handle);
    prevVelocity.delete(handle);
  }

  /** @param {number} handle @returns {BodyRecord|undefined} */
  function getRecord(handle) {
    return bodies.get(handle);
  }

  /** Every live body record. The game layer iterates this to sync meshes. */
  function allRecords() {
    return bodies.values();
  }

  /**
   * Advances the simulation by real elapsed time, in whole fixed steps.
   *
   * Assumes `onImpact` is cheap; it is called once per contact force event per step.
   * Impacts are reported with pre-step velocities, so the energy is the energy going
   * into the collision rather than what survived it. Returns the number of steps run,
   * which the caller can use to detect that it is falling behind.
   *
   * @param {number} elapsedSeconds Real time since the last call.
   * @param {(impact: Impact) => void} onImpact
   * @returns {number}
   */
  function step(elapsedSeconds, onImpact) {
    // Clamp the incoming time before it enters the accumulator. A tab that was hidden
    // for a minute returns one enormous delta, and without this the game would try to
    // simulate that minute in one frame and never recover.
    accumulator += Math.min(elapsedSeconds, WORLD.FIXED_TIMESTEP * WORLD.MAX_STEPS_PER_FRAME);

    let steps = 0;
    while (accumulator >= WORLD.FIXED_TIMESTEP && steps < WORLD.MAX_STEPS_PER_FRAME) {
      cacheVelocities();
      world.step(eventQueue);
      drainImpacts(onImpact);
      accumulator -= WORLD.FIXED_TIMESTEP;
      steps += 1;
    }
    return steps;
  }

  function cacheVelocities() {
    prevVelocity.clear();
    for (const [handle, rec] of bodies) {
      if (rec.body.isSleeping()) continue;
      const v = rec.body.linvel();
      prevVelocity.set(handle, { x: v.x, y: v.y, z: v.z });
    }
  }

  const ZERO = { x: 0, y: 0, z: 0 };

  /**
   * @typedef {object} Impact
   * @property {number|null} handleA  Body handle, or null for the ground.
   * @property {number|null} handleB
   * @property {BodyRecord|null} recordA
   * @property {BodyRecord|null} recordB
   * @property {number} energy        Joules.
   * @property {{x:number,y:number,z:number}} normal Unit contact direction.
   * @property {number} force         Peak contact force magnitude, newtons.
   */
  function drainImpacts(onImpact) {
    eventQueue.drainContactForceEvents((event) => {
      const hA = colliderToBody.get(event.collider1());
      const hB = colliderToBody.get(event.collider2());
      // undefined means a collider we do not track. null means the ground, which we do.
      if (hA === undefined || hB === undefined) return;

      const recA = hA === null ? null : bodies.get(hA);
      const recB = hB === null ? null : bodies.get(hB);
      if (!recA && !recB) return;

      const vA = (hA !== null && prevVelocity.get(hA)) || ZERO;
      const vB = (hB !== null && prevVelocity.get(hB)) || ZERO;
      const n = event.maxForceDirection();

      // Approach speed along the contact normal. Sign is discarded: a collision is a
      // collision whichever way round the pair was reported.
      const relN = Math.abs((vA.x - vB.x) * n.x + (vA.y - vB.y) * n.y + (vA.z - vB.z) * n.z);

      // Reduced mass. A fixed body behaves as infinite mass, so the pair's reduced mass
      // is just the moving body's mass.
      const mA = recA ? recA.mass : Infinity;
      const mB = recB ? recB.mass : Infinity;
      let mu;
      if (mA === Infinity) mu = mB;
      else if (mB === Infinity) mu = mA;
      else mu = (mA * mB) / (mA + mB);

      const energy = 0.5 * mu * relN * relN;
      if (!Number.isFinite(energy) || energy <= 0) return;

      onImpact({
        handleA: hA,
        handleB: hB,
        recordA: recA ?? null,
        recordB: recB ?? null,
        energy,
        normal: { x: n.x, y: n.y, z: n.z },
        force: event.maxForceMagnitude(),
      });
    });
    // Collision start and stop events are not used, but the queue must be drained or it
    // grows without bound, which the Rapier documentation calls out explicitly.
    eventQueue.drainCollisionEvents(() => {});
  }

  /**
   * Total speed summed across every non sleeping body, SU per second.
   *
   * Used to decide the world has settled, which gates level clear and level fail.
   *
   * `kinds` filters which bodies count. The session passes pieces and fragments only,
   * deliberately excluding balls: a ball rolling slowly across the sand is not a reason
   * to withhold a level clear, and treating it as one leaves the results screen waiting
   * for ammunition to stop moving while the structure has plainly been flattened. That
   * was a real defect, found by playing a level through in a browser.
   *
   * @param {Set<string>|null} [kinds] Body kinds to count, or null for all.
   * @returns {number}
   */
  function totalMotion(kinds = null) {
    let sum = 0;
    for (const rec of bodies.values()) {
      if (kinds && !kinds.has(rec.kind)) continue;
      if (rec.body.isSleeping()) continue;
      const v = rec.body.linvel();
      sum += Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }
    return sum;
  }

  /** Number of live bodies, for the debug overlay and the body budget spike. */
  function bodyCount() {
    return bodies.size;
  }

  /** Releases the Rapier world. Called when a level is torn down. */
  function dispose() {
    bodies.clear();
    colliderToBody.clear();
    prevVelocity.clear();
    world.free();
  }

  return {
    addBody,
    addBall,
    removeBody,
    getRecord,
    allRecords,
    step,
    totalMotion,
    bodyCount,
    dispose,
    /** Exposed only for the debug overlay and the deterministic test rig. */
    raw: world,
  };
}

/** @typedef {ReturnType<typeof createPhysicsWorld>} PhysicsWorld */
