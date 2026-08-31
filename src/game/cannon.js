/**
 * cannon.js
 *
 * OWNS: the cannon's aim state, its mesh, the muzzle flash, and the position and
 * velocity a ball leaves with.
 *
 * MUST NOT OWN: input handling (src/input/controls.js turns a drag into an aim delta),
 * ball bodies (src/game/ball.js), or the fire rate policy, which is a constant.
 *
 * Aim is stored as yaw and pitch in radians, both clamped. Yaw is rotation about world
 * Y, zero pointing straight down the playfield, positive to the player's right. Pitch is
 * elevation above horizontal, zero being level.
 *
 * The barrel is built from primitives rather than a model because the kit contains no
 * cannon, and a stack of cylinders reads correctly at the size it appears on screen.
 * Art credit: original to this project.
 */

import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

import { CANNON } from '../core/constants.js';

/** Original palette for the cannon. Not sampled from the reference clip. */
const COLORS = {
  barrel: 0x2f5fa8,
  trim: 0xe8a13c,
  base: 0x8a5a33,
  flash: 0xffdf8e,
};

/**
 * Creates the cannon.
 *
 * Assumes `parent` is a scene graph node that lives for the whole session, not a level.
 * The cannon persists across levels. Returns the controller the game loop drives.
 *
 * @param {import('three').Object3D} parent
 */
export function createCannon(parent) {
  const root = new Group();
  root.name = 'cannon';
  root.position.set(...CANNON.POSITION);
  parent.add(root);

  // Yaw is applied to `root`, pitch to `pitchPivot`, so the two never interfere.
  const pitchPivot = new Group();
  root.add(pitchPivot);

  const barrel = new Mesh(
    new CylinderGeometry(CANNON.BARREL_RADIUS * 0.82, CANNON.BARREL_RADIUS, CANNON.BARREL_LENGTH, 20),
    new MeshStandardMaterial({ color: COLORS.barrel, roughness: 0.55, metalness: 0.2 }),
  );
  // The cylinder is authored along Y. A quarter turn about X lays it along -Z, which is
  // down the playfield, and the offset moves its base to the pivot rather than centring
  // it, so the pivot is at the breech where a real trunnion would be.
  barrel.rotation.x = -Math.PI / 2;
  barrel.position.z = -CANNON.BARREL_LENGTH / 2;
  barrel.castShadow = true;
  pitchPivot.add(barrel);

  const muzzleRing = new Mesh(
    new TorusGeometry(CANNON.BARREL_RADIUS * 0.86, 0.07, 8, 20),
    new MeshStandardMaterial({ color: COLORS.trim, roughness: 0.4, metalness: 0.35 }),
  );
  muzzleRing.position.z = -CANNON.BARREL_LENGTH;
  muzzleRing.castShadow = true;
  pitchPivot.add(muzzleRing);

  const base = new Mesh(
    new CylinderGeometry(0.72, 0.92, 0.5, 16),
    new MeshStandardMaterial({ color: COLORS.base, roughness: 0.9, metalness: 0 }),
  );
  base.position.y = -0.62;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // Muzzle flash: a sphere plus a light, both switched on for a few frames. The light
  // is what puts the bright patch on the sand that the reference clip shows.
  const flashMesh = new Mesh(
    new SphereGeometry(0.5, 12, 10),
    new MeshBasicMaterial({ color: COLORS.flash, transparent: true, opacity: 0.9, fog: false }),
  );
  flashMesh.position.z = -CANNON.BARREL_LENGTH - 0.15;
  flashMesh.visible = false;
  pitchPivot.add(flashMesh);

  const flashLight = new PointLight(COLORS.flash, 0, 9, 2);
  flashLight.position.copy(flashMesh.position);
  pitchPivot.add(flashLight);

  let yaw = 0;
  let pitch = 0.16;
  let flashTimer = 0;

  const muzzleWorld = new Vector3();
  const forwardWorld = new Vector3();

  applyAim();

  function applyAim() {
    root.rotation.y = yaw;
    pitchPivot.rotation.x = pitch;
  }

  /**
   * Moves the aim by a delta in radians, clamping to the configured limits.
   *
   * Clamping is why the barrel can never point at the sky, which would waste a shot, or
   * back at the player, which the reference clip never shows.
   *
   * @param {number} dYaw
   * @param {number} dPitch
   */
  function aimBy(dYaw, dPitch) {
    yaw = clamp(yaw + dYaw, -CANNON.YAW_LIMIT_RAD, CANNON.YAW_LIMIT_RAD);
    pitch = clamp(pitch + dPitch, CANNON.PITCH_MIN_RAD, CANNON.PITCH_MAX_RAD);
    applyAim();
  }

  /** Sets aim absolutely. Used when a level starts, to face straight ahead. */
  function setAim(newYaw, newPitch) {
    yaw = clamp(newYaw, -CANNON.YAW_LIMIT_RAD, CANNON.YAW_LIMIT_RAD);
    pitch = clamp(newPitch, CANNON.PITCH_MIN_RAD, CANNON.PITCH_MAX_RAD);
    applyAim();
  }

  /**
   * Where a ball starts and how fast it leaves, in world space.
   *
   * Assumes the scene graph's world matrices are current for this frame, which they are
   * after the renderer has run at least once, and which updateMatrixWorld guarantees
   * here regardless. Returns fresh objects safe to keep.
   *
   * @returns {{position: {x:number,y:number,z:number}, velocity: {x:number,y:number,z:number}}}
   */
  function muzzle() {
    root.updateMatrixWorld(true);
    // Local -Z is down the barrel. Transforming the muzzle point and a point one unit
    // further along gives both the position and the direction without duplicating the
    // yaw and pitch maths that the scene graph has already done.
    muzzleWorld.set(0, 0, -CANNON.BARREL_LENGTH).applyMatrix4(pitchPivot.matrixWorld);
    forwardWorld.set(0, 0, -CANNON.BARREL_LENGTH - 1)
      .applyMatrix4(pitchPivot.matrixWorld)
      .sub(muzzleWorld)
      .normalize();

    return {
      position: { x: muzzleWorld.x, y: muzzleWorld.y, z: muzzleWorld.z },
      velocity: {
        x: forwardWorld.x * CANNON.MUZZLE_SPEED,
        y: forwardWorld.y * CANNON.MUZZLE_SPEED,
        z: forwardWorld.z * CANNON.MUZZLE_SPEED,
      },
    };
  }

  /** Triggers the muzzle flash. Called by the game when a shot actually leaves. */
  function flash() {
    flashTimer = CANNON.FLASH_DURATION_S;
  }

  /**
   * Advances the flash. Call once per rendered frame.
   * @param {number} dt Seconds.
   */
  function update(dt) {
    if (flashTimer <= 0) return;
    flashTimer = Math.max(0, flashTimer - dt);
    const t = flashTimer / CANNON.FLASH_DURATION_S;
    flashMesh.visible = t > 0;
    flashMesh.material.opacity = t * 0.9;
    flashMesh.scale.setScalar(0.7 + (1 - t) * 0.8);
    flashLight.intensity = t * 26;
  }

  return {
    root,
    aimBy,
    setAim,
    muzzle,
    flash,
    update,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

/** @typedef {ReturnType<typeof createCannon>} Cannon */
