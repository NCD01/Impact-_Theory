/**
 * session.js
 *
 * OWNS: one play session. Which level is loaded, how many balls remain, when a level is
 * cleared or failed, and the scoring run attached to it.
 *
 * MUST NOT OWN: rendering, the DOM, or input. It is driven by main.js and reports what
 * happened through callbacks, so the same logic serves the game and a test.
 *
 * The settle rule, which is why clearing is not instant. A structure mid collapse can
 * satisfy the clear condition for a single frame while a pile is still moving, and
 * showing a results screen over a moving pile looks like a bug. So a level is only
 * declared cleared once the clear condition holds and the world has been quiet for
 * LEVEL.SETTLE_TIME_S. The same applies to failing: the last ball has to come to rest
 * before a level is called lost, because that ball may still bring the tower down.
 */

import { LEVEL, DIFFICULTY } from '../core/constants.js';
import { createScoring, ballAllowance } from './scoring.js';
import { assertValidLevel } from './level.js';

/** @typedef {'playing'|'cleared'|'failed'} SessionState */

/**
 * Creates a play session for one level.
 *
 * Assumes `level` has been validated, `structure` is empty and ready to be filled, and
 * `balls` has been cleared. Places the level's pieces as a side effect, so the session
 * is playable the moment it returns.
 *
 * @param {object} deps
 * @param {object} deps.level          A validated level object.
 * @param {string} deps.difficultyId   Key into DIFFICULTY.
 * @param {object} deps.structure      From createStructure().
 * @param {object} deps.balls          From createBalls().
 * @param {(event: object) => void} deps.onEvent  Told about scores, clears and failures.
 */
export function createSession({ level, difficultyId, structure, balls, onEvent }) {
  assertValidLevel(level, `level ${level?.id}`);
  const difficulty = DIFFICULTY[difficultyId] ?? DIFFICULTY.easy;

  const allowance = ballAllowance(difficulty, level.par);
  const scoring = createScoring(difficulty, level.par);

  /** @type {SessionState} */
  let state = 'playing';
  let elapsed = 0;
  let ballsFired = 0;
  let settleTimer = 0;
  let failTimer = 0;
  /** Seconds since the clear condition first held, whether or not the world is quiet. */
  let clearedFor = 0;
  /** Pieces destroyed since the last collapse rumble, to trigger one per collapse. */
  let sinceRumble = 0;
  let rumbleCooldown = 0;

  structure.setDifficultyTuning(difficulty);
  balls.setRadius(difficulty.ballRadius);
  for (const spec of level.pieces) structure.place(spec);

  /**
   * Whether another ball may be fired.
   *
   * On a difficulty with unlimited balls this is always true while playing, which is
   * what makes Easy have no fail state at all rather than a very distant one.
   *
   * @returns {boolean}
   */
  function canFire() {
    if (state !== 'playing') return false;
    // Once the platform is clear the level is decided, so further shots are refused. They
    // would only churn the rubble and hold off the results screen, and they would cost
    // the player balls against their star rating for a level they have already won.
    if (structure.isCleared()) return false;
    if (allowance === null) return true;
    return ballsFired < allowance;
  }

  /**
   * Records that a ball actually left the cannon.
   * Called only when the ball manager confirms one was created, so a shot declined
   * because the world was full does not cost the player a ball.
   */
  function ballFired() {
    ballsFired += 1;
  }

  /**
   * Called by the structure when a piece is destroyed.
   *
   * @param {object} entry The piece entry.
   */
  function pieceDestroyed(entry) {
    const award = scoring.pieceDestroyed(entry.family.id, elapsed);
    sinceRumble += 1;
    onEvent({ type: 'score', ...award, family: entry.family.id, piece: entry.piece.id });
  }

  /**
   * Advances the session clock and checks for a clear or a failure.
   *
   * Assumes it is called once per rendered frame with the real frame time, and that
   * `worldMotion` is the physics world's total motion, used to tell a settled world from
   * a moving one.
   *
   * @param {number} dt Seconds.
   * @param {number} worldMotion Sum of body speeds, from PhysicsWorld.totalMotion().
   */
  function update(dt, worldMotion) {
    if (state !== 'playing') return;
    elapsed += dt;
    if (rumbleCooldown > 0) rumbleCooldown -= dt;

    // One rumble per collapse rather than one per piece. Three pieces going in quick
    // succession is a collapse; one piece is a hit.
    if (sinceRumble >= 3 && rumbleCooldown <= 0) {
      onEvent({ type: 'collapse', pieces: sinceRumble });
      rumbleCooldown = 1.6;
      sinceRumble = 0;
    }

    const quiet = worldMotion < LEVEL.SETTLE_SPEED_EPSILON;

    if (structure.isCleared()) {
      // Nothing is left standing on the platform, so the level is over. The only thing
      // left to decide is when to show the result.
      clearedFor += dt;

      // The clear condition can hold for a single frame mid collapse, so it has to hold
      // while the world is also quiet before the results screen appears over a moving
      // pile. But the wait is capped: a player who keeps firing into the rubble disturbs
      // it constantly, and without a ceiling the level would never end at all. That was a
      // real defect, with every piece off the platform and the game still playing.
      settleTimer = quiet ? settleTimer + dt : 0;
      if (settleTimer >= LEVEL.SETTLE_TIME_S || clearedFor >= LEVEL.MAX_SETTLE_WAIT_S) {
        state = 'cleared';
        const result = scoring.finish(ballsFired, allowance === null);
        onEvent({ type: 'cleared', result });
      }
      return;
    }
    settleTimer = 0;
    clearedFor = 0;

    // Failure only exists on a difficulty that allows it, and only once every ball has
    // been spent and the world has stopped, because the last ball may still bring the
    // structure down after it lands.
    if (difficulty.canFail && allowance !== null && ballsFired >= allowance
      && balls.liveCount === 0) {
      failTimer = quiet ? failTimer + dt : 0;
      if (failTimer >= LEVEL.FAIL_GRACE_S) {
        state = 'failed';
        onEvent({ type: 'failed', ballsUsed: ballsFired, par: level.par });
      }
    } else {
      failTimer = 0;
    }
  }

  /** A snapshot for the heads up display. Allocates one small object per frame. */
  function hud() {
    return {
      levelId: level.id,
      levelName: level.name,
      par: level.par,
      score: scoring.score,
      combo: scoring.combo,
      ballsFired,
      ballsLeft: allowance === null ? null : Math.max(0, allowance - ballsFired),
      standing: structure.standingCount(),
      destroyed: structure.destroyedCount,
      state,
    };
  }

  return {
    update,
    canFire,
    ballFired,
    pieceDestroyed,
    hud,
    get state() { return state; },
    get level() { return level; },
    get scoring() { return scoring; },
    get ballsFired() { return ballsFired; },
    get allowance() { return allowance; },
    get difficulty() { return difficulty; },
  };
}
