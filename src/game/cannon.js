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
 * The cannon is built from primitives rather than a model, because the block kit contains
 * no cannon and no new modelling was in scope. It is a stack of turned sections: a fat
 * breech, two gold bands, a tapered barrel, a muzzle ring, a dark bore, trunnions, a
 * carriage drum and a patterned mat. The owner asked for more detail after the first
 * version, which was a single plain cone and read as a traffic bollard.
 * Art credit: original to this project.
 */

import {
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

import { CANNON, WORLD } from '../core/constants.js';

/** Gravity as a positive magnitude, which is the form the ballistic solve wants. */
const GRAVITY = Math.abs(WORLD.GRAVITY_Y);

/** Original palette for the cannon. Not sampled from the reference clip. */
/** Original palette for the cannon. Not sampled from the reference clip. */
const COLORS = {
  barrel: 0x2f6fc4,
  barrelDark: 0x1f4a86,
  trim: 0xe8a13c,
  base: 0x8a5a33,
  mat: 0xb4523a,
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

  // ---- The barrel ---------------------------------------------------------
  // Built from a stack of parts rather than one cone. The reference cannon is a blue
  // barrel with gold bands at the muzzle and the breech and a decorated base, and the
  // owner asked for that detail; a single plain cone read as a traffic bollard.
  const barrelMat = new MeshStandardMaterial({
    color: COLORS.barrel, roughness: 0.45, metalness: 0,
  });
  const barrelDarkMat = new MeshStandardMaterial({
    color: COLORS.barrelDark, roughness: 0.5, metalness: 0,
  });
  const trimMat = new MeshStandardMaterial({
    color: COLORS.trim, roughness: 0.35, metalness: 0,
  });

  const R = CANNON.BARREL_RADIUS;
  const L = CANNON.BARREL_LENGTH;

  /**
   * Adds a barrel section. `from` and `to` are distances from the pivot along the barrel,
   * so a section reads as "from here to there" rather than as a centre and a length.
   */
  const barrelSection = (from, to, rFrom, rTo, material, segments = 22) => {
    const m = new Mesh(new CylinderGeometry(rTo, rFrom, to - from, segments), material);
    // Authored along Y; a quarter turn about X lays it along -Z, down the playfield.
    m.rotation.x = -Math.PI / 2;
    m.position.z = -(from + to) / 2;
    m.castShadow = true;
    pitchPivot.add(m);
  };

  // Breech, the fat end at the back, with a gold band in front of it.
  barrelSection(-0.18, 0.16, R * 1.16, R * 1.12, barrelDarkMat);
  barrelSection(0.16, 0.3, R * 1.12, R * 1.08, trimMat);
  // The main taper.
  barrelSection(0.3, L * 0.72, R * 1.06, R * 0.92, barrelMat);
  // A second gold band two thirds along, which is what gives the barrel its length.
  barrelSection(L * 0.72, L * 0.79, R * 0.94, R * 0.94, trimMat);
  // The muzzle run.
  barrelSection(L * 0.79, L, R * 0.9, R * 0.84, barrelMat);

  // The muzzle ring itself, a fat torus around the mouth.
  const muzzleRing = new Mesh(new TorusGeometry(R * 0.88, 0.085, 10, 24), trimMat);
  muzzleRing.position.z = -L;
  muzzleRing.castShadow = true;
  pitchPivot.add(muzzleRing);

  // A dark bore, so the mouth reads as a hole rather than a flat cap.
  const bore = new Mesh(
    new CylinderGeometry(R * 0.62, R * 0.62, 0.5, 18, 1, true),
    new MeshStandardMaterial({ color: 0x14181f, roughness: 1, side: DoubleSide }),
  );
  bore.rotation.x = -Math.PI / 2;
  bore.position.z = -L + 0.22;
  pitchPivot.add(bore);

  // Trunnions, the two stubs the barrel would pivot on. Small, but they are what make it
  // read as a cannon on a carriage rather than a tube floating in the sand.
  for (const side of [-1, 1]) {
    const trunnion = new Mesh(new CylinderGeometry(0.1, 0.1, 0.22, 10), trimMat);
    trunnion.rotation.z = Math.PI / 2;
    trunnion.position.set(side * (R * 1.05), 0, -L * 0.3);
    trunnion.castShadow = true;
    pitchPivot.add(trunnion);
  }

  // ---- The base -----------------------------------------------------------
  // A carriage drum on a patterned mat, matching the decorated base in the reference.
  const base = new Mesh(
    new CylinderGeometry(0.66, 0.86, 0.46, 20),
    new MeshStandardMaterial({ color: COLORS.base, roughness: 0.85, metalness: 0 }),
  );
  base.position.y = -0.6;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const baseBand = new Mesh(new TorusGeometry(0.7, 0.06, 8, 22), trimMat);
  baseBand.rotation.x = Math.PI / 2;
  baseBand.position.y = -0.42;
  root.add(baseBand);

  // The mat the cannon stands on, laid flat just above the sand so it does not z-fight.
  const mat = new Mesh(
    new CylinderGeometry(1.35, 1.35, 0.05, 26),
    new MeshStandardMaterial({ color: COLORS.mat, roughness: 0.95, metalness: 0 }),
  );
  mat.position.y = -CANNON.POSITION[1] + 0.03;
  mat.receiveShadow = true;
  root.add(mat);

  const matRing = new Mesh(new TorusGeometry(1.18, 0.07, 8, 30), trimMat);
  matRing.rotation.x = Math.PI / 2;
  matRing.position.y = -CANNON.POSITION[1] + 0.06;
  matRing.receiveShadow = true;
  root.add(matRing);

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

  /**
   * Aims the barrel so that a ball fired now would land on `target`.
   *
   * This is what makes "point at the block you want to hit" work, rather than "point the
   * barrel at the block", which are different things because a ball falls on the way. At
   * this muzzle speed a shot across the playfield drops well over a metre, so a barrel
   * pointed straight at a target lands short every time.
   *
   * The solve is the standard projectile launch angle for a target at horizontal distance
   * d and height difference h, fired at speed v under gravity g:
   *
   *     tan(theta) = (v^2 - sqrt(v^4 - g*(g*d^2 + 2*h*v^2))) / (g*d)
   *
   * The minus root is the flat trajectory rather than the lobbed one, which is the shot a
   * player expects from a cannon. If the discriminant is negative the target is out of
   * range at this speed, and the barrel goes to 45 degrees, which is the angle that
   * reaches furthest.
   *
   * Runs twice because the muzzle moves when the aim changes: the launch point is at the
   * end of a 1.9 SU barrel, so solving from the old muzzle position and then re-solving
   * from the new one converges immediately.
   *
   * Assumes `target` is in world space, in SU. Clamps to the aim limits afterwards, so a
   * target behind the player or straight overhead produces the nearest legal aim rather
   * than a wild one.
   *
   * @param {{x: number, y: number, z: number}} target
   */
  function aimAt(target) {
    for (let pass = 0; pass < 2; pass += 1) {
      const from = muzzle().position;

      const dx = target.x - from.x;
      const dz = target.z - from.z;
      const d = Math.hypot(dx, dz);
      const h = target.y - from.y;

      // Barrel points along local -Z at zero yaw, and a positive rotation about +Y swings
      // it toward -X. So the yaw that points at (dx, dz) is atan2(-dx, -dz). Getting this
      // sign wrong is what made dragging right aim left in v1.9.0.
      const wantYaw = Math.atan2(-dx, -dz);

      let wantPitch;
      if (d < 1e-3) {
        wantPitch = CANNON.PITCH_MAX_RAD;
      } else {
        const v2 = CANNON.MUZZLE_SPEED * CANNON.MUZZLE_SPEED;
        const g = GRAVITY;
        const disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
        wantPitch = disc < 0
          // Out of range. 45 degrees reaches furthest, so it is the best available answer.
          ? Math.PI / 4
          : Math.atan((v2 - Math.sqrt(disc)) / (g * d));
      }

      yaw = clamp(wantYaw, -CANNON.YAW_LIMIT_RAD, CANNON.YAW_LIMIT_RAD);
      pitch = clamp(wantPitch, CANNON.PITCH_MIN_RAD, CANNON.PITCH_MAX_RAD);
      applyAim();
    }
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
    aimAt,
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
