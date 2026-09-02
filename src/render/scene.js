/**
 * scene.js
 *
 * OWNS: the renderer, the scene graph root, the fixed camera, lighting, the ground and
 * backdrop, the resize response, and camera shake.
 *
 * MUST NOT OWN: game state, physics, or input. Nothing here knows what a level is.
 *
 * The camera never moves during play, matching the reference clip. Shake is applied as
 * an offset around the fixed position and decays to nothing, so the camera always
 * returns to exactly where it started rather than drifting over a long session.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

import { CAMERA, PLAYFIELD, SHAKE, WORLD } from '../core/constants.js';
import { createBackdrop } from './backdrop.js';

/** Palette. Original to this project; no colour is sampled from the reference clip. */
const PALETTE = {
  sand: 0xe6c98f,
  sandFar: 0xd9b877,
  skyTop: 0x3f9fd8,
  skyBottom: 0xb9e4f2,
  sunlight: 0xfff3dc,
  ambient: 0x9fc4de,
  fog: 0xcfe6f0,
};

/**
 * Creates the renderer, scene and camera.
 *
 * Assumes `canvas` is attached to the document. Call `resize()` once before the first
 * frame. The returned object owns the renderer and must be disposed when the game ends.
 *
 * @param {HTMLCanvasElement} canvas
 */
export function createSceneRig(canvas) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(PALETTE.skyBottom, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  scene.background = new Color(PALETTE.skyBottom);
  // Fog hides the far edge of the ground plane without needing a bigger plane. It starts
  // well past the playfield and ends past the backdrop, so the beach reads as distant
  // rather than being swallowed by haze.
  scene.fog = new Fog(PALETTE.fog, 70, 230);

  const camera = new PerspectiveCamera(
    CAMERA.FOV_PORTRAIT_DEG, 1, CAMERA.NEAR, CAMERA.FAR,
  );
  const basePosition = new Vector3(...CAMERA.POSITION);
  const lookAt = new Vector3(...CAMERA.LOOK_AT);
  camera.position.copy(basePosition);
  camera.lookAt(lookAt);

  // ---- Lighting -----------------------------------------------------------
  // One key light with shadows plus fill. A stylised kit does not need more, and each
  // extra shadow casting light costs a full shadow map render every frame on a phone.
  const sun = new DirectionalLight(PALETTE.sunlight, 2.4);
  sun.position.set(-9, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  // The shadow frustum is sized to the playfield, not the world. A frustum covering the
  // whole 120 SU ground would spread 1024 texels so thin the shadows would be mush.
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0016;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, PLAYFIELD.STRUCTURE_ORIGIN[2]);

  scene.add(new AmbientLight(PALETTE.ambient, 1.5));

  // ---- Ground -------------------------------------------------------------
  const ground = new Mesh(
    new PlaneGeometry(WORLD.GROUND_HALF_EXTENT * 2, WORLD.GROUND_HALF_EXTENT * 2),
    new MeshStandardMaterial({ color: PALETTE.sand, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = PLAYFIELD.GROUND_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Sky dome -----------------------------------------------------------
  // A large inverted sphere rather than a flat backdrop, so the horizon stays put in both
  // portrait and landscape without re-authoring anything. Its radius must stay inside
  // CAMERA.FAR or the top of the dome is clipped and the clear colour shows through as a
  // seam across the sky.
  const sky = new Mesh(
    new SphereGeometry(300, 24, 16),
    new MeshBasicMaterial({ color: PALETTE.skyTop, side: BackSide, fog: false }),
  );
  scene.add(sky);

  // The beach behind the playfield. Built once and never torn down, because nothing in it
  // belongs to a level.
  const backdrop = createBackdrop(scene);

  /** Everything a level owns hangs here, so tearing a level down is one removal. */
  const levelRoot = new Group();
  levelRoot.name = 'levelRoot';
  scene.add(levelRoot);

  // ---- Shake --------------------------------------------------------------
  let shakeAmplitude = 0;
  let shakePhase = 0;
  const shakeOffset = new Vector3();

  /**
   * Adds camera shake for an impact.
   *
   * Assumes `energy` is joules from the physics layer. Below SHAKE.MIN_ENERGY_J nothing
   * happens at all, so grazes stay quiet and only real hits move the camera. Amplitude
   * accumulates so a collapse shakes harder than one block, and is clamped so a pile-up
   * cannot throw the camera off the playfield.
   *
   * @param {number} energy
   */
  function addShake(energy) {
    if (energy < SHAKE.MIN_ENERGY_J) return;
    shakeAmplitude = Math.min(
      SHAKE.MAX_AMPLITUDE,
      shakeAmplitude + energy * SHAKE.AMPLITUDE_PER_JOULE,
    );
  }

  /**
   * Advances shake and writes the camera position for this frame.
   * Must be called once per rendered frame, before render().
   *
   * @param {number} dt Seconds since the last frame.
   */
  function updateCamera(dt) {
    if (shakeAmplitude > 0.0005) {
      shakePhase += dt * SHAKE.FREQUENCY_HZ * Math.PI * 2;
      // Two different frequencies on the two axes, so the motion reads as a jolt
      // rather than as a circle.
      shakeOffset.set(
        Math.sin(shakePhase) * shakeAmplitude,
        Math.sin(shakePhase * 1.7 + 1.1) * shakeAmplitude * 0.8,
        0,
      );
      shakeAmplitude *= SHAKE.DECAY_PER_SECOND ** dt;
    } else {
      shakeAmplitude = 0;
      shakeOffset.set(0, 0, 0);
    }
    camera.position.copy(basePosition).add(shakeOffset);
    camera.lookAt(lookAt);
  }

  /**
   * Points the camera at the middle of a structure of a given height.
   *
   * Called once when a level loads, never during play, so the camera is still fixed for
   * the whole of a level as the reference clip shows. Only the aim point moves; the eye
   * stays where CAMERA.POSITION puts it, because moving the eye changes how big a ball
   * looks and therefore how the game plays.
   *
   * How far away a structure sits is handled elsewhere, by placing short levels nearer
   * the cannon. That is the only lever that works here: fitting a 3 SU structure into
   * the frame by moving the camera would put the camera in front of its own cannon.
   *
   * @param {number} structureHeight Top of the tallest piece, SU.
   */
  function frameLevel(structureHeight) {
    lookAt.set(
      CAMERA.LOOK_AT[0],
      Math.max(2.0, Math.min(structureHeight * 0.55, 6.2)),
      CAMERA.LOOK_AT[2],
    );
    camera.position.copy(basePosition);
    camera.lookAt(lookAt);
  }

  /**
   * Resizes the renderer and camera to the canvas's displayed size.
   *
   * Field of view is switched between a portrait and a landscape value rather than left
   * fixed, because a fixed vertical field of view on a tall narrow phone shows far less
   * of the playfield than the same value on a wide desktop window.
   *
   * Device pixel ratio is capped at 2. A modern phone reports 3 or more, and rendering
   * nine times the pixels of a logical viewport is the single largest avoidable cost on
   * the target device.
   *
   * @returns {{width: number, height: number, aspect: number}}
   */
  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;

    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    renderer.setSize(width, height, false);

    camera.aspect = aspect;
    camera.fov = aspect < CAMERA.PORTRAIT_ASPECT_THRESHOLD
      ? CAMERA.FOV_PORTRAIT_DEG
      : CAMERA.FOV_LANDSCAPE_DEG;
    camera.updateProjectionMatrix();

    return { width, height, aspect };
  }

  function render() {
    renderer.render(scene, camera);
  }

  function dispose() {
    backdrop.dispose();
    renderer.dispose();
  }

  return {
    renderer, scene, camera, levelRoot, sun,
    addShake, updateCamera, frameLevel, resize, render, dispose,
    palette: PALETTE,
  };
}

/** @typedef {ReturnType<typeof createSceneRig>} SceneRig */
