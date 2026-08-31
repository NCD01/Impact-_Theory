/**
 * scoring.js
 *
 * OWNS: what a destroyed piece is worth, how a combo builds, the end of level bonus, and
 * how many stars a run earns.
 *
 * MUST NOT OWN: when a piece is destroyed (src/game/structure.js), what a level's par is
 * (the level file), or how results are stored (src/save/save.js).
 *
 * Kept free of three.js, Rapier and the DOM so the whole model is unit testable. Every
 * number it uses comes from src/core/constants.js.
 *
 * The combo rule, in words. Pieces destroyed within COMBO_WINDOW_S of each other belong
 * to the same chain. The multiplier starts at 1 and rises by COMBO_STEP for each further
 * piece in the chain, up to a ceiling. The window is set to roughly how long a collapse
 * takes to propagate down a stack, so one good shot that brings a tower down reads as one
 * large combo rather than five unrelated hits. That is the behaviour worth rewarding: the
 * brief's scoring section asks for a combo on a chain reaction from one shot.
 */

import { SCORING, STARS } from '../core/constants.js';
import { getFamily } from '../blocks/families.js';

/**
 * Creates a scoring run for one level attempt.
 *
 * Assumes `difficulty` is a record from DIFFICULTY in constants. Time is supplied by the
 * caller rather than read from a clock, so a test can drive a whole combo chain without
 * waiting, and so the model is deterministic.
 *
 * @param {{starBands: {THREE_AT_OR_UNDER_PAR: number, TWO_WITHIN: number}}} difficulty
 * @param {number} par
 */
export function createScoring(difficulty, par) {
  let score = 0;
  let comboCount = 0;
  let lastDestroyAt = -Infinity;
  let bestCombo = 0;
  let destroyed = 0;

  /**
   * Records one destroyed piece and returns what it was worth.
   *
   * Assumes `familyId` is a real family and `now` is a monotonically non decreasing time
   * in seconds. Returns the points awarded and the multiplier they were awarded at, so
   * the interface can show a popup with the same numbers the score used, rather than
   * recomputing them and drifting.
   *
   * @param {string} familyId
   * @param {number} now Seconds, from the game clock.
   * @returns {{points: number, multiplier: number, combo: number, total: number}}
   */
  function pieceDestroyed(familyId, now) {
    const family = getFamily(familyId);

    // Within the window the chain continues; outside it a new chain starts at one piece.
    comboCount = (now - lastDestroyAt <= SCORING.COMBO_WINDOW_S) ? comboCount + 1 : 1;
    lastDestroyAt = now;
    if (comboCount > bestCombo) bestCombo = comboCount;

    const multiplier = Math.min(
      SCORING.COMBO_MAX_MULTIPLIER,
      1 + (comboCount - 1) * SCORING.COMBO_STEP,
    );
    const points = Math.round(SCORING.BASE_PIECE_POINTS * family.scoreWeight * multiplier);
    score += points;
    destroyed += 1;

    return { points, multiplier, combo: comboCount, total: score };
  }

  /**
   * Finishes the run and returns the result.
   *
   * Assumes the level has been cleared. `ballsUsed` counts shots that actually left the
   * cannon. On a difficulty with unlimited balls there is no saved ball bonus, because
   * there is nothing to save; the stars still work, with a wider band.
   *
   * @param {number} ballsUsed
   * @param {boolean} unlimitedBalls
   * @returns {{score: number, stars: number, bonus: number, destroyed: number,
   *            bestCombo: number, ballsUsed: number, par: number}}
   */
  function finish(ballsUsed, unlimitedBalls) {
    const ballsSaved = unlimitedBalls ? 0 : Math.max(0, par - ballsUsed);
    const bonus = ballsSaved * SCORING.BALL_SAVED_POINTS;
    score += bonus;
    return {
      score,
      stars: starsFor(ballsUsed, par, difficulty.starBands),
      bonus,
      destroyed,
      bestCombo,
      ballsUsed,
      par,
    };
  }

  return {
    pieceDestroyed,
    finish,
    get score() { return score; },
    get combo() { return comboCount; },
    get bestCombo() { return bestCombo; },
    get destroyed() { return destroyed; },
  };
}

/**
 * Stars earned for clearing a level with a given number of balls.
 *
 * Three stars for clearing at or under par, plus whatever slack the difficulty allows.
 * Two for clearing within the wider band. One for clearing at all, which is the floor:
 * a cleared level is never worth zero stars, because a child who finished a level and
 * was shown nothing has been told they failed.
 *
 * @param {number} ballsUsed
 * @param {number} par
 * @param {{THREE_AT_OR_UNDER_PAR: number, TWO_WITHIN: number}} bands
 * @returns {1|2|3}
 */
export function starsFor(ballsUsed, par, bands = STARS.NORMAL) {
  if (ballsUsed <= par + bands.THREE_AT_OR_UNDER_PAR) return 3;
  if (ballsUsed <= par + bands.TWO_WITHIN) return 2;
  return 1;
}

/**
 * How many balls a difficulty grants for a level.
 *
 * Returns null for unlimited, which the interface shows as a dash rather than a number.
 * Null rather than a large number on purpose: a large number is a fail state a long way
 * off, and Easy is specified to have no fail state at all.
 *
 * @param {{ballLimitFromPar: number|null}} difficulty
 * @param {number} par
 * @returns {number|null}
 */
export function ballAllowance(difficulty, par) {
  if (difficulty.ballLimitFromPar === null) return null;
  return par + difficulty.ballLimitFromPar;
}
