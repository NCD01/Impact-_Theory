/**
 * balls.js
 *
 * OWNS: the balls in flight, their meshes, their lifetime, and the cap on how many can
 * exist at once.
 *
 * MUST NOT OWN: the fire rate (a constant, enforced by src/input/controls.js), how many
 * balls a level grants (src/game/level.js), or what happens when a ball hits something
 * (src/game/structure.js).
 *
 * Balls are capped and aged out for one reason: hold-to-stream lets a player put a shot
 * in the air every 170 ms, and without a cap a held thumb would spend the whole body
 * budget on ammunition and leave nothing for the structure it is aimed at.
 *
 * The striped look comes from a two colour vertex pattern rather than a texture, so the
 * game ships no image for it and the stripes survive at any size. The colours are
 * original to this project.
 */

import {
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Color,
  BufferAttribute,
} from 'three';

import { BALL, PLAYFIELD } from '../core/constants.js';

/** Original colours. Not sampled from the reference clip. */
const STRIPE_A = 0xf2f2ef;
const STRIPE_B = 0xe2503f;
const STRIPE_C = 0x2f7fc4;

/**
 * Builds the shared ball geometry with baked stripe colours.
 *
 * Vertex colours are used rather than a texture because the pattern is three flat bands
 * and a texture would be an asset to source, license and load for something a few lines
 * of arithmetic produce exactly.
 *
 * @param {number} radius
 * @returns {SphereGeometry}
 */
function createStripedSphere(radius) {
  const geom = new SphereGeometry(radius, 18, 14);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new Color(STRIPE_A);
  const b = new Color(STRIPE_B);
  const c = new Color(STRIPE_C);

  for (let i = 0; i < pos.count; i += 1) {
    // Band by latitude, so the stripes wrap the ball the way a beach ball's do.
    const y = pos.getY(i) / radius;
    const band = Math.floor((y + 1) * 3) % 3;
    const col = band === 0 ? a : (band === 1 ? b : c);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geom.setAttribute('color', new BufferAttribute(colors, 3));
  return geom;
}

/**
 * Creates the ball manager.
 *
 * Assumes `physics` is a PhysicsWorld and `root` is a scene node. Radius is set per
 * difficulty via setRadius before the first shot; changing it rebuilds the shared
 * geometry, which happens at most once per level.
 *
 * @param {object} deps
 * @param {import('../physics/world.js').PhysicsWorld} deps.physics
 * @param {import('three').Object3D} deps.root
 */
export function createBalls({ physics, root }) {
  /** @type {Map<number, {handle: number, mesh: Mesh, age: number}>} */
  const live = new Map();

  let radius = BALL.RADIUS_NORMAL;
  let geometry = createStripedSphere(radius);
  const material = new MeshStandardMaterial({
    vertexColors: true, roughness: 0.55, metalness: 0.05,
  });

  let firedCount = 0;

  /**
   * Sets the ball radius for subsequent shots. Rebuilds the shared geometry.
   * Balls already in flight keep the size they were fired at.
   *
   * @param {number} r SU.
   */
  function setRadius(r) {
    if (r === radius) return;
    radius = r;
    geometry.dispose();
    geometry = createStripedSphere(radius);
  }

  /**
   * Fires a ball.
   *
   * Returns false and does nothing when the cap is already reached, so the caller can
   * decline to spend a ball from the level's allowance on a shot that never existed.
   *
   * @param {{position: object, velocity: object}} muzzle From the cannon.
   * @returns {boolean} Whether a ball was actually created.
   */
  function fire(muzzle) {
    if (live.size >= BALL.MAX_ALIVE) return false;

    const handle = physics.addBall({
      position: muzzle.position,
      velocity: muzzle.velocity,
      radius,
      density: BALL.DENSITY,
      restitution: BALL.RESTITUTION,
      friction: BALL.FRICTION,
      userData: { ball: true },
    });

    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(muzzle.position.x, muzzle.position.y, muzzle.position.z);
    root.add(mesh);

    live.set(handle, { handle, mesh, age: 0 });
    firedCount += 1;
    return true;
  }

  /**
   * Syncs meshes and retires old or escaped balls. Call once per rendered frame.
   * @param {number} dt Seconds.
   */
  function update(dt) {
    for (const ball of [...live.values()]) {
      const rec = physics.getRecord(ball.handle);
      if (!rec) { live.delete(ball.handle); continue; }

      const t = rec.body.translation();
      const r = rec.body.rotation();
      ball.mesh.position.set(t.x, t.y, t.z);
      ball.mesh.quaternion.set(r.x, r.y, r.z, r.w);

      ball.age += dt;
      if (ball.age > BALL.LIFETIME_S || t.y < BALL.KILL_BELOW_Y
        || Math.hypot(t.x, t.z - PLAYFIELD.STRUCTURE_ORIGIN[2]) > PLAYFIELD.OUT_OF_PLAY_RADIUS * 2) {
        retire(ball.handle);
      }
    }
  }

  function retire(handle) {
    const ball = live.get(handle);
    if (!ball) return;
    physics.removeBody(handle);
    root.remove(ball.mesh);
    live.delete(handle);
  }

  /** Removes every ball. Called between levels. */
  function clear() {
    for (const handle of [...live.keys()]) retire(handle);
    firedCount = 0;
  }

  function dispose() {
    clear();
    geometry.dispose();
    material.dispose();
  }

  return {
    fire,
    update,
    clear,
    dispose,
    setRadius,
    get liveCount() { return live.size; },
    get firedCount() { return firedCount; },
    get radius() { return radius; },
  };
}
