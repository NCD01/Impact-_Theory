/**
 * main.js
 *
 * OWNS: application startup, the single animation loop, and wiring the modules to each
 * other. It is the only file that knows every other module exists.
 *
 * MUST NOT OWN: any rule. If a decision about the game is being made in this file, it
 * is in the wrong place. Startup order, frame order and error reporting are its job.
 *
 * Frame order matters and is not arbitrary:
 *   1. controls.update    turns a held pointer into shots for this frame
 *   2. physics.step       advances the simulation in fixed steps, reporting impacts
 *   3. structure.update   syncs meshes to the bodies physics just moved
 *   4. balls.update       same, and retires expired balls
 *   5. dust and cannon    decoration, which must follow the things they decorate
 *   6. camera and render
 * Running step 3 before step 2 would draw every object one frame behind the simulation,
 * which reads as input lag that no amount of tuning fixes.
 */

import { GAME_NAME, VERSION } from './core/version.js';
import { createProjection } from './core/projection.js';
import { initPhysics, createPhysicsWorld } from './physics/world.js';
import { createSceneRig } from './render/scene.js';
import { createDust } from './render/dust.js';
import { loadAllPieceModels, getLoadFailures } from './blocks/loader.js';
import { createStructure } from './game/structure.js';
import { createBalls } from './game/balls.js';
import { createCannon } from './game/cannon.js';
import { createControls } from './input/controls.js';
import { DIFFICULTY, DEFAULT_DIFFICULTY } from './core/constants.js';
import { buildStressStack } from './game/stress.js';

const boot = document.getElementById('boot');
const bootStatus = document.getElementById('boot-status');
const bootError = document.getElementById('boot-error');

/** Reports a fatal startup problem in the page rather than only in the console. */
function fail(stage, err) {
  console.error(`[Impact Theory] ${stage} failed`, err);
  if (bootStatus) bootStatus.textContent = 'Could not start';
  if (bootError) bootError.textContent = `${stage} failed.\n\n${err?.stack ?? err}`;
  boot?.classList.remove('hidden');
}

/**
 * The demonstration structure used by the vertical slice, before the level format
 * exists. Two supports carrying a stack, which is the arrangement the reference clip
 * shows and the one that proves supports drop what stands on them.
 *
 * Coordinates are SU relative to PLAYFIELD.STRUCTURE_ORIGIN.
 */
const SLICE_STRUCTURE = [
  // Two steel columns carrying everything above them. Marked as supports, so the level
  // clears when the load is down even if the columns are still standing.
  { piece: 'S01_ROUND_COLUMN', x: -2, y: 0, support: true },
  { piece: 'S01_ROUND_COLUMN', x: 2, y: 0, support: true },
  // A 4 SU beam spanning both column tops at y = 3.
  { piece: 'B03_LONG_BEAM', x: 0, y: 3 },
  // Four crates across the beam.
  { piece: 'B01_SMALL_BLOCK', x: -1.5, y: 4 },
  { piece: 'B01_SMALL_BLOCK', x: -0.5, y: 4 },
  { piece: 'B01_SMALL_BLOCK', x: 0.5, y: 4 },
  { piece: 'B01_SMALL_BLOCK', x: 1.5, y: 4 },
  // Two 2 SU crates bridging them.
  { piece: 'B02_MEDIUM_BLOCK', x: -1, y: 5 },
  { piece: 'B02_MEDIUM_BLOCK', x: 1, y: 5 },
  // A concrete block, and a brick arch balanced on top of it.
  { piece: 'B05_LARGE_BLOCK', x: 0, y: 6 },
  { piece: 'S05_ARCH', x: 0, y: 8 },
];

async function start() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) throw new Error('No #game-canvas in the document');

  // ---- Physics ------------------------------------------------------------
  bootStatus.textContent = 'Starting physics';
  await initPhysics();
  const physics = createPhysicsWorld();

  // ---- Rendering ----------------------------------------------------------
  bootStatus.textContent = 'Building the scene';
  const rig = createSceneRig(canvas);
  const projection = createProjection(canvas, rig.camera);
  rig.resize();
  projection.resize();

  // ---- Models -------------------------------------------------------------
  bootStatus.textContent = 'Loading the block kit';
  const load = await loadAllPieceModels(import.meta.env.BASE_URL);
  if (load.failed > 0) {
    // A missing model is not fatal: the loader substitutes a box of the right size, so
    // the level still plays. It is reported loudly because a silent substitution is
    // exactly how an asset phase reports success while shipping nothing.
    console.warn(
      `[Impact Theory] ${load.failed} of ${load.failed + load.loaded} models failed to load:`,
      Object.fromEntries(getLoadFailures()),
    );
  }

  // ---- Game objects -------------------------------------------------------
  const dust = createDust(rig.levelRoot);
  const balls = createBalls({ physics, root: rig.levelRoot });
  const cannon = createCannon(rig.scene);

  let lastImpactEnergy = 0;
  /**
   * Every impact energy seen since the last reset, joules. Used to calibrate the damage
   * floor and the per family hit points against what the simulation actually produces,
   * rather than against a guess. Read by the tuning harness.
   */
  const impactLog = [];
  const structure = createStructure({
    physics,
    root: rig.levelRoot,
    dust,
    onDestroyed: () => {},
  });

  const tuning = DIFFICULTY[DEFAULT_DIFFICULTY];
  structure.setDifficultyTuning(tuning);
  balls.setRadius(tuning.ballRadius);

  // ?stress=N replaces the level with a wall of N pieces from the real kit, for the
  // body budget spike. It is a measurement affordance, not a game mode: it uses the
  // same place() call, the same colliders and the same materials a level does, because
  // a budget measured on placeholder cubes is a budget for a different game.
  const stressCount = Number(new URLSearchParams(location.search).get('stress'));
  const layout = Number.isFinite(stressCount) && stressCount > 0
    ? buildStressStack(stressCount)
    : SLICE_STRUCTURE;
  for (const spec of layout) structure.place(spec);

  // ---- Input --------------------------------------------------------------
  const controls = createControls(canvas, projection, {
    onAim: (dYaw, dPitch) => cannon.aimBy(dYaw, dPitch),
    onFire: () => {
      if (balls.fire(cannon.muzzle())) cannon.flash();
    },
  });

  // ---- Resize -------------------------------------------------------------
  // One listener, and both the renderer and the projection helper are told. The helper
  // caches the canvas rectangle, so forgetting it here would leave every touch aiming
  // at the wrong place after a rotation while the picture looked correct.
  const onResize = () => {
    rig.resize();
    projection.resize();
  };
  globalThis.addEventListener('resize', onResize);
  globalThis.addEventListener('orientationchange', onResize);

  // ---- Loop ---------------------------------------------------------------
  let last = performance.now();
  /** Rolling buffer of frame times in milliseconds, for the body budget spike. */
  const frameTimes = [];
  let frames = 0;
  let fpsWindowStart = last;
  let fps = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    controls.update(dt);

    physics.step(dt, (impact) => {
      if (impactLog.length < 20000) impactLog.push(Math.round(impact.energy));
      const applied = structure.handleImpact(impact);
      if (applied > 0) {
        lastImpactEnergy = impact.energy;
        rig.addShake(impact.energy);
      }
    });

    structure.update(dt);
    balls.update(dt);
    dust.update(dt);
    cannon.update(dt);

    rig.updateCamera(dt);
    rig.render();

    frameTimes.push(dt * 1000);
    if (frameTimes.length > 1200) frameTimes.shift();

    frames += 1;
    if (now - fpsWindowStart >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsWindowStart));
      frames = 0;
      fpsWindowStart = now;
    }

    // A small, deliberate debug surface. Playwright reads this rather than scraping
    // pixels, and it is the same object the debug overlay will render later.
    globalThis.__IMPACT_THEORY__ = {
      version: VERSION,
      fps,
      bodies: physics.bodyCount(),
      balls: balls.liveCount,
      ballsFired: balls.firedCount,
      standing: structure.standingCount(),
      destroyed: structure.destroyedCount,
      fragments: structure.fragmentCount,
      dust: dust.liveCount,
      cleared: structure.isCleared(),
      lastImpactEnergy: Math.round(lastImpactEnergy),
      modelsLoaded: load.loaded,
      modelsFailed: load.failed,
      ready: true,
      /** Clears the frame time buffer, so a harness can measure a chosen window. */
      resetFrameTimes: () => { frameTimes.length = 0; },
      /** A copy of the frame times recorded since the last reset, milliseconds. */
      getFrameTimes: () => frameTimes.slice(),
      /** Every impact energy recorded so far, joules. For damage calibration. */
      getImpactLog: () => impactLog.slice(),
      resetImpactLog: () => { impactLog.length = 0; },
    };

    requestAnimationFrame(frame);
  }

  boot.classList.add('hidden');
  console.info(`${GAME_NAME} v${VERSION} started. ${load.loaded} models loaded.`);
  requestAnimationFrame(frame);
}

start().catch((err) => fail('Startup', err));
