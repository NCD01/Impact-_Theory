/**
 * main.js
 *
 * OWNS: application startup, the single animation loop, the screen state machine, and
 * wiring the modules to each other. It is the only file that knows every other module
 * exists.
 *
 * MUST NOT OWN: any game rule. If a decision about the game is being made in this file,
 * it is in the wrong place. Startup order, frame order and error reporting are its job.
 *
 * Frame order matters and is not arbitrary:
 *   1. controls.update    turns a held pointer into shots for this frame
 *   2. physics.step       advances the simulation in fixed steps, reporting impacts
 *   3. structure.update   syncs meshes to the bodies physics just moved
 *   4. balls.update       same, and retires expired balls
 *   5. session.update     decides whether the level is cleared or lost
 *   6. dust, cannon, ui   decoration, which must follow the things they decorate
 *   7. camera and render
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
import { placePedestals, PLATFORM_TOP as PLATFORM_HEIGHT } from './game/pedestal.js';
import { createBalls } from './game/balls.js';
import { createCannon } from './game/cannon.js';
import { createControls } from './input/controls.js';
import { createSession } from './game/session.js';
import { loadShippedLevels, summariseLevel } from './game/level.js';
import { generateEndlessLevel } from './game/endless.js';
import { createSaveStore } from './save/save.js';
import { createAudio } from './audio/audio.js';
import { createHaptics } from './game/haptics.js';
import { createUI } from './ui/ui.js';
import { CAMERA, DIFFICULTY, PLAYFIELD } from './core/constants.js';
import { buildStressStack } from './game/stress.js';

/**
 * Body kinds whose motion decides whether the world has settled.
 *
 * Balls are excluded on purpose. A ball rolling across the sand long after the tower
 * has fallen is not a reason to withhold the results screen.
 */
const SETTLE_KINDS = new Set(['piece', 'fragment']);

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

async function start() {
  const canvas = document.getElementById('game-canvas');
  const uiRoot = document.getElementById('ui');
  if (!canvas || !uiRoot) throw new Error('The page is missing #game-canvas or #ui');

  const params = new URLSearchParams(globalThis.location.search);
  const stressCount = Number(params.get('stress'));
  const stressMode = Number.isFinite(stressCount) && stressCount > 0;
  const showDebug = params.has('debug') || stressMode;

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

  // ---- Data and services --------------------------------------------------
  const levels = loadShippedLevels();
  const summaries = levels.map(summariseLevel);
  const save = createSaveStore();
  if (save.loadNote) console.info(`[Impact Theory] ${save.loadNote}`);
  const audio = createAudio();
  audio.setMuted(save.state.muted);
  const haptics = createHaptics();
  haptics.setEnabled(save.state.vibrate);

  // ---- Game objects -------------------------------------------------------
  const dust = createDust(rig.levelRoot);
  const balls = createBalls({ physics, root: rig.levelRoot });
  const cannon = createCannon(rig.scene);

  /** The live session, or null when no level is loaded. */
  let session = null;
  /** 'title' | 'select' | 'playing' | 'paused' | 'results' | 'settings' */
  let screen = 'title';
  /** Endless round number when in endless mode, otherwise null. */
  let endlessRound = null;
  let lastImpactEnergy = 0;
  let lastResult = null;
  /** Where the last piece was destroyed, so a score popup can be anchored to it. */
  let lastDestroyedAt = { x: 0, y: 0, z: 0 };
  /** World Z of the plane the player aims within. Set per level with the structure. */
  let currentAimDepth = PLAYFIELD.STRUCTURE_ORIGIN[2];
  /** The pedestals the current level stands on, or null between levels. */
  let pedestals = null;

  const structure = createStructure({
    physics,
    root: rig.levelRoot,
    dust,
    onDestroyed: (entry, at) => {
      lastDestroyedAt = at;
      audio.fracture(entry.family.id);
      session?.pieceDestroyed(entry);
    },
  });

  const ui = createUI(uiRoot, projection, {
    onAnyPress: () => { audio.resume(); audio.uiTap(); },
    // Play starts playing. The owner's words were "when you click play just start", and
    // he is right: a child pressing Play wants a cannon, not a menu. The level select is
    // still one press away from the title and from the pause screen.
    onPlay: () => startLevel(nextUnplayedLevelId()),
    onChooseLevel: () => openSelect(),
    onEndless: () => startEndless(1),
    onSelectLevel: (id) => startLevel(id),
    onPause: () => pause(),
    onResume: () => resume(),
    onRetry: () => retry(),
    onQuit: () => quitToSelect(),
    onNext: () => next(),
    onDifficulty: (id) => {
      save.setDifficulty(id);
      ui.syncSettings(save.state, haptics.available);
    },
    onToggleShake: () => {
      save.setShake(!save.state.shake);
      ui.syncSettings(save.state, haptics.available);
    },
    onToggleVibrate: () => {
      save.setVibrate(!save.state.vibrate);
      haptics.setEnabled(save.state.vibrate);
      ui.syncSettings(save.state, haptics.available);
    },
    onToggleMute: () => {
      save.setMuted(!save.state.muted);
      audio.setMuted(save.state.muted);
      ui.syncSettings(save.state, haptics.available);
    },
    onResetProgress: () => {
      save.reset();
      haptics.setEnabled(save.state.vibrate);
      ui.syncSettings(save.state, haptics.available);
      refreshSelect();
    },
  });
  ui.setVersion(`v${VERSION}`);
  ui.syncSettings(save.state, haptics.available);

  /**
   * Where to place a structure, so that it fits the frame.
   *
   * Both dimensions matter, and on a portrait phone width matters more. The camera's
   * vertical field of view is 58 degrees, but a 390 by 844 screen has an aspect of about
   * 0.46, so the horizontal field of view is less than half the vertical one. A twelve
   * unit wide level therefore needs roughly twice the distance a twelve unit tall one
   * does. Framing on height alone put level 29 so close that it overflowed the screen in
   * both directions, which is how this was found.
   *
   * The distance that fits a span S into a share `k` of the field of view is
   * S / (2 * tan(fov / 2) * k), with the horizontal case multiplied by the aspect ratio.
   * Both are computed and the larger wins, then it is clamped so nothing ends up in
   * front of the muzzle or lost in the fog.
   *
   * @param {number} height Top of the tallest piece, SU.
   * @param {number} width Full span including piece widths, SU.
   * @returns {[number, number, number]}
   */
  function originForSize(height, width) {
    /** Nearest a structure may sit. Any closer and the barrel overlaps it. */
    const NEAREST = 13.5;
    /** Furthest. Beyond this the scene fog starts to wash the structure out. */
    const FURTHEST = 28;
    /** Share of the frame the structure should fill, vertically and horizontally. */
    const VERTICAL_SHARE = 0.6;
    const HORIZONTAL_SHARE = 0.82;
    /** The narrowest aspect ratio to design for: a tall phone in portrait. */
    const PORTRAIT_ASPECT = 0.46;

    const tanHalfFov = Math.tan((CAMERA.FOV_PORTRAIT_DEG * Math.PI) / 360);
    const forHeight = height / (2 * tanHalfFov * VERTICAL_SHARE);
    const forWidth = width / (2 * tanHalfFov * PORTRAIT_ASPECT * HORIZONTAL_SHARE);

    const distance = Math.min(FURTHEST, Math.max(NEAREST, forHeight, forWidth));
    const base = PLAYFIELD.STRUCTURE_ORIGIN;
    return [base[0], base[1], CAMERA.POSITION[2] - distance];
  }

  /**
   * The level to open when the player presses Play.
   *
   * The first level they have not cleared, so Play resumes rather than restarting. Falls
   * back to the last level once every one is cleared, because sending someone who has
   * finished the game back to level 1 is worse than letting them replay the hardest.
   *
   * @returns {number}
   */
  function nextUnplayedLevelId() {
    for (const level of levels) {
      if (!save.getLevelRecord(level.id)?.cleared) return level.id;
    }
    return levels[levels.length - 1].id;
  }

  // ---- Screen transitions -------------------------------------------------

  function clearWorld() {
    haptics.stop();
    structure.clear();
    balls.clear();
    pedestals?.clear();
    pedestals = null;
    session = null;
  }

  function refreshSelect() {
    ui.renderLevelSelect(
      summaries,
      (id) => {
        const rec = save.getLevelRecord(id);
        return { unlocked: save.isUnlocked(id), stars: rec?.stars ?? 0, score: rec?.score ?? 0 };
      },
      save.totalStars(),
    );
  }

  function openSelect() {
    clearWorld();
    endlessRound = null;
    refreshSelect();
    screen = 'select';
    ui.show('select');
    controls.setEnabled(false);
  }

  function openTitle() {
    clearWorld();
    endlessRound = null;
    screen = 'title';
    ui.show('title');
    controls.setEnabled(false);
  }

  function beginSession(level) {
    clearWorld();
    cannon.setAim(0, 0.16);
    // Place and frame this level for its size before anything is built, so a small
    // level fills the screen rather than sitting as a speck under an empty sky. Both
    // are set once here and then stay fixed for the whole level.
    const shape = summariseLevel(level);
    // Structures stand on the pedestals, so the framing has to account for the plinth
    // height as well as the structure's own.
    const origin = originForSize(shape.height + PLATFORM_HEIGHT, shape.width);
    structure.setOrigin(origin);
    currentAimDepth = origin[2];
    rig.frameLevel(shape.height + PLATFORM_HEIGHT);

    // Pedestals first: they are fixed scenery and everything else rests on them.
    pedestals = placePedestals({
      physics,
      root: rig.levelRoot,
      xs: level.pedestals ?? [0],
      origin,
    });

    // A piece is standing while it is on the platform, and down once it is off it. Set
    // before the first place(), because every piece is judged against this.
    structure.setPlatform({
      top: pedestals.top,
      minX: pedestals.minX,
      maxX: pedestals.maxX,
    });
    session = createSession({
      level,
      difficultyId: save.state.difficulty,
      structure,
      balls,
      onEvent: handleSessionEvent,
    });
    screen = 'playing';
    ui.show('none');
    ui.updateHud(session.hud());
    controls.setEnabled(true);
    // Show the how to play hint the first time anyone opens a level, and never again.
    if (!save.state.seenHint) {
      ui.showHint();
      save.setSeenHint();
    } else {
      ui.hideHint();
    }
  }

  function startLevel(id) {
    const level = levels.find((l) => l.id === id);
    if (!level) return;
    endlessRound = null;
    beginSession(level);
  }

  function startEndless(round) {
    endlessRound = round;
    beginSession(generateEndlessLevel(round));
  }

  function pause() {
    if (screen !== 'playing') return;
    haptics.stop();
    screen = 'paused';
    ui.show('pause');
    controls.setEnabled(false);
  }

  function resume() {
    if (screen !== 'paused') return;
    screen = 'playing';
    ui.show('none');
    controls.setEnabled(true);
  }

  function retry() {
    if (!session) return;
    beginSession(session.level);
  }

  function quitToSelect() {
    if (endlessRound !== null) openTitle();
    else openSelect();
  }

  function next() {
    if (endlessRound !== null) {
      startEndless(endlessRound + 1);
      return;
    }
    const current = session?.level.id ?? 0;
    if (current < levels.length) startLevel(current + 1);
    else openSelect();
  }

  // ---- Session events -----------------------------------------------------

  function handleSessionEvent(event) {
    if (event.type === 'score') {
      // The popup is anchored where the piece actually was, and the world to screen
      // conversion goes through the projection helper. Standard 4.
      ui.addScorePopup(lastDestroyedAt, event.points, event.multiplier);
      return;
    }
    if (event.type === 'collapse') {
      audio.rumble(Math.min(1, event.pieces / 8));
      return;
    }
    if (event.type === 'cleared') {
      audio.levelClear();
      haptics.levelClear();
      const result = { ...event.result, cleared: true };
      lastResult = result;
      if (endlessRound === null) save.recordLevelResult(session.level.id, result);
      else save.setEndlessBest(result.score);
      screen = 'results';
      controls.setEnabled(false);
      ui.showResults(result, endlessRound !== null || session.level.id < levels.length);
      return;
    }
    if (event.type === 'failed') {
      audio.levelFailed();
      lastResult = { cleared: false, ...event };
      screen = 'results';
      controls.setEnabled(false);
      ui.showResults(lastResult, false);
    }
  }

  // ---- Input --------------------------------------------------------------
  const controls = createControls(canvas, projection, {
    onAimAt: (target) => cannon.aimAt(target),
    // The plane the player points within is the structure's own depth, so pointing at a
    // block on screen resolves to that block's position in the world.
    getAimDepth: () => currentAimDepth,
    onFire: () => {
      audio.resume();
      if (stressMode) {
        if (balls.fire(cannon.muzzle())) { cannon.flash(); audio.fire(); }
        return;
      }
      if (!session || !session.canFire()) return;
      if (balls.fire(cannon.muzzle())) {
        cannon.flash();
        audio.fire();
        session.ballFired();
      }
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

  // ---- Opening state ------------------------------------------------------
  if (stressMode) {
    // The body budget spike replaces the level with a wall of N pieces from the real
    // kit. A measurement affordance, not a game mode: it uses the same place() call,
    // the same colliders and the same materials a level does.
    structure.setDifficultyTuning(DIFFICULTY[save.state.difficulty]);
    for (const spec of buildStressStack(stressCount)) structure.place(spec);
    screen = 'playing';
    ui.show('none');
    controls.setEnabled(true);
  } else {
    ui.show('title');
  }

  // ---- Loop ---------------------------------------------------------------
  let last = performance.now();
  /** Rolling buffer of frame times in milliseconds, for the body budget spike. */
  const frameTimes = [];
  /** Every impact energy since the last reset, joules, for damage calibration. */
  const impactLog = [];
  let frames = 0;
  let fpsWindowStart = last;
  let fps = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    audio.beginFrame();

    const running = screen === 'playing';
    if (running) {
      controls.update(dt);

      physics.step(dt, (impact) => {
        if (impactLog.length < 20000) impactLog.push(Math.round(impact.energy));
        const applied = structure.handleImpact(impact);

        // Shake and sound fire on EVERY impact, not only on ones that did damage.
        //
        // This was a real defect. Feedback used to be gated behind `applied > 0`, so a
        // block that had already run out of hit points, or one merely landing hard on the
        // sand, moved the camera not at all. The owner's words were that the screen "does
        // not tend to vibrate" when the bricks fall, and he was right: the loudest moment
        // in the game, a tower hitting the ground, was the quietest one on screen.
        // Both functions have their own energy floors, so grazes still stay silent.
        if (save.state.shake) rig.addShake(impact.energy);
        // The device buzzes rather than the camera moving. A phone has a motor for this,
        // and moving the picture takes the view away at the moment it matters most.
        haptics.impact(impact.energy);
        const family = structure.familyOfImpact(impact);
        if (family) audio.impact(impact.energy, family);
        if (applied > 0) lastImpactEnergy = impact.energy;
      });

      structure.update(dt);
      balls.update(dt);
      if (session) {
        session.update(dt, physics.totalMotion(SETTLE_KINDS));
        ui.updateHud(session.hud());
      }
    }

    dust.update(dt);
    cannon.update(dt);
    ui.update(dt);

    rig.updateCamera(dt);
    rig.render();

    frameTimes.push(dt * 1000);
    if (frameTimes.length > 1200) frameTimes.shift();

    frames += 1;
    if (now - fpsWindowStart >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsWindowStart));
      frames = 0;
      fpsWindowStart = now;
      if (showDebug) {
        ui.setDebug(
          `v${VERSION}  ${fps} fps\n`
          + `bodies ${physics.bodyCount()}  pieces ${structure.pieceCount}\n`
          + `frags ${structure.fragmentCount}  balls ${balls.liveCount}\n`
          + `impact ${Math.round(lastImpactEnergy)} J`,
        );
      }
    }

    // A small, deliberate debug surface. Playwright reads this rather than scraping
    // pixels, and it is the same data the debug overlay renders.
    globalThis.__IMPACT_THEORY__ = {
      version: VERSION,
      screen,
      fps,
      bodies: physics.bodyCount(),
      balls: balls.liveCount,
      ballsFired: session?.ballsFired ?? balls.firedCount,
      standing: structure.standingCount(),
      destroyed: structure.destroyedCount,
      fragments: structure.fragmentCount,
      dust: dust.liveCount,
      cleared: session ? session.state === 'cleared' : false,
      sessionState: session?.state ?? null,
      levelId: session?.level.id ?? null,
      score: session?.scoring.score ?? 0,
      lastImpactEnergy: Math.round(lastImpactEnergy),
      lastResult,
      modelsLoaded: load.loaded,
      modelsFailed: load.failed,
      levelCount: levels.length,
      audioAvailable: audio.available,
      hapticsAvailable: haptics.available,
      unlocked: save.state.unlocked,
      difficulty: save.state.difficulty,
      ready: true,
      resetFrameTimes: () => { frameTimes.length = 0; },
      getFrameTimes: () => frameTimes.slice(),
      getImpactLog: () => impactLog.slice(),
      resetImpactLog: () => { impactLog.length = 0; },
    };

    // Aim state, exposed for the browser tests. Read only; the tests assert the sign of
    // the yaw, because a sign error here is what made dragging right aim left.
    globalThis.__IT_CANNON__ = { yaw: cannon.yaw, pitch: cannon.pitch };

    // Camera position, for the browser diagnostics. Used to prove the camera is actually
    // still when shake is off, rather than assuming it.
    globalThis.__IT_CAMERA__ = {
      x: rig.camera.position.x, y: rig.camera.position.y, z: rig.camera.position.z,
    };

    // Live piece positions, for the browser tests only. Used to measure whether a hit
    // actually moves anything, which is a question screenshots cannot answer.
    globalThis.__IT_PLATFORM__ = structure.platform;
    globalThis.__IT_PIECES__ = [...structure._pieces.values()].map((e) => {
      const rec = physics.getRecord(e.handle);
      const t = rec ? rec.body.translation() : { x: 0, y: 0, z: 0 };
      return {
        id: e.handle,
        piece: e.piece.id,
        x: t.x,
        y: t.y,
        z: t.z,
        startCentreY: e.startCentreY,
        state: structure.pieceState(e),
        down: structure.isPieceDown(e),
      };
    });

    requestAnimationFrame(frame);
  }

  boot.classList.add('hidden');
  console.info(
    `${GAME_NAME} v${VERSION} started. ${load.loaded} models, ${levels.length} levels, `
    + `audio ${audio.available ? 'ready' : 'unavailable'}.`,
  );
  requestAnimationFrame(frame);
}

start().catch((err) => fail('Startup', err));
