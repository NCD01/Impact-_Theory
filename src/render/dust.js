/**
 * dust.js
 *
 * OWNS: the dust burst that accompanies a fracture, and the debris motes thrown from it.
 *
 * MUST NOT OWN: fragments. A fragment is a real rigid body with mass that lands and
 * stays; dust is decoration with no physics at all. Confusing the two is one of the
 * cheap fakes the brief names, where particles stand in for structural failure. Dust
 * here accompanies a fracture that has already happened in the physics world.
 *
 * Implementation: one Points object holding a fixed pool of particles, recycled. A pool
 * means a collapse cannot allocate, and one draw call covers every puff on screen.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
} from 'three';

import { DESTRUCTION } from '../core/constants.js';

/** Pool size. Enough for several simultaneous fractures without allocating. */
const POOL = 420;

/**
 * Creates the dust system.
 *
 * Assumes `parent` outlives individual levels. Call `update(dt)` once per frame and
 * `burst()` when a piece fractures.
 *
 * @param {import('three').Object3D} parent
 */
export function createDust(parent) {
  const positions = new Float32Array(POOL * 3);
  const velocities = new Float32Array(POOL * 3);
  const life = new Float32Array(POOL);
  const size = new Float32Array(POOL);
  const alpha = new Float32Array(POOL);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('size', new BufferAttribute(size, 1));
  geometry.setAttribute('alphaMul', new BufferAttribute(alpha, 1));

  const material = new PointsMaterial({
    // Dust reads as lit haze, so it brightens what is behind it rather than tinting it.
    color: 0xf2e3c6,
    size: 0.34,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: true,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'dust';
  parent.add(points);

  // Particles start far below the world so an unused slot is never visible.
  const PARKED_Y = -1000;
  for (let i = 0; i < POOL; i += 1) positions[i * 3 + 1] = PARKED_Y;

  let cursor = 0;
  let liveCount = 0;

  /**
   * Emits a dust burst at a point.
   *
   * Assumes `scale` is roughly the size of the piece that broke, so a long beam throws
   * more dust than a small block. Oldest particles are recycled when the pool is full,
   * which is preferable to dropping the burst: a fracture with no dust reads as a bug.
   *
   * @param {{x:number,y:number,z:number}} at
   * @param {number} [scale] Rough piece size in SU.
   * @param {number} [count]
   */
  function burst(at, scale = 1, count = DESTRUCTION.DUST_PARTICLES) {
    for (let n = 0; n < count; n += 1) {
      const i = cursor;
      cursor = (cursor + 1) % POOL;
      const p = i * 3;

      const spread = 0.34 * scale;
      positions[p] = at.x + (Math.random() - 0.5) * spread;
      positions[p + 1] = at.y + (Math.random() - 0.5) * spread;
      positions[p + 2] = at.z + (Math.random() - 0.5) * spread;

      // Outward and upward. Dust from a collapse rises; it does not fall like debris.
      velocities[p] = (Math.random() - 0.5) * 1.5 * scale;
      velocities[p + 1] = DESTRUCTION.DUST_RISE_SPEED * (0.5 + Math.random()) * scale;
      velocities[p + 2] = (Math.random() - 0.5) * 1.5 * scale;

      life[i] = DESTRUCTION.DUST_LIFETIME_S * (0.7 + Math.random() * 0.6);
      size[i] = (0.5 + Math.random()) * scale;
      alpha[i] = 1;
      liveCount += 1;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Advances every live particle. Call once per rendered frame.
   * @param {number} dt Seconds.
   */
  function update(dt) {
    if (liveCount <= 0) return;
    let live = 0;
    for (let i = 0; i < POOL; i += 1) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const p = i * 3;
      if (life[i] <= 0) {
        positions[p + 1] = PARKED_Y;
        continue;
      }
      live += 1;
      positions[p] += velocities[p] * dt;
      positions[p + 1] += velocities[p + 1] * dt;
      positions[p + 2] += velocities[p + 2] * dt;
      // Drag, so dust slows and hangs rather than flying off in a straight line.
      const drag = 1 - Math.min(1, 2.6 * dt);
      velocities[p] *= drag;
      velocities[p + 1] *= drag;
      velocities[p + 2] *= drag;
    }
    liveCount = live;
    geometry.attributes.position.needsUpdate = true;
    // The whole cloud fades together. Per particle alpha would need a custom shader,
    // which is not worth a draw call's worth of complexity for a puff of dust.
    material.opacity = live > 0 ? 0.62 : 0;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    parent.remove(points);
  }

  return { burst, update, dispose, get liveCount() { return liveCount; } };
}
