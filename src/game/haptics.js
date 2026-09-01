/**
 * haptics.js
 *
 * OWNS: making the device buzz on an impact, and the rate limiting that keeps a collapse
 * from turning into one continuous drone in the player's hand.
 *
 * MUST NOT OWN: when an impact happens, or what it is worth. The game layer calls in with
 * an energy in joules; this file decides how long the motor runs.
 *
 * WHY THIS EXISTS INSTEAD OF CAMERA SHAKE.
 *
 * The owner put it exactly: "you can shake a mobile device but not screen". He is right,
 * and it is the better idea. A phone has a vibration motor, and that is the honest channel
 * for the physical feedback of a heavy hit. Moving the camera to simulate the same thing
 * takes the picture away from the player at the moment they most want to see it, which is
 * why it read as unpleasant through two rounds of tuning.
 *
 * So camera shake is off by default and this is on by default. Both are switchable.
 *
 * WHAT IT CANNOT DO.
 *
 * The Vibration API is not available on iOS Safari at all, and some browsers only allow it
 * after a user gesture. Neither is an error here: if the device cannot buzz, nothing
 * happens and the game plays exactly as before. `available` reports which case you are in
 * so the settings screen can say so rather than offering a switch that does nothing.
 */

import { HAPTICS } from '../core/constants.js';

/**
 * Creates the haptics controller.
 *
 * Assumes nothing about the environment. On a device or browser with no vibration motor
 * every method is a no-op and `available` is false.
 */
export function createHaptics() {
  const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  let enabled = true;
  /** Timestamp of the last buzz, so a collapse does not become one long drone. */
  let lastAt = -Infinity;

  /**
   * Buzzes for an impact, with a duration scaled by its energy.
   *
   * Assumes `energy` is joules from the physics layer. Below HAPTICS.MIN_ENERGY_J nothing
   * happens, so the constant small contacts of a settling structure stay silent in the
   * hand. Returns whether the motor was actually asked to run, which the tests check.
   *
   * Rate limited rather than queued. A collapse produces dozens of qualifying impacts in a
   * second and running the motor for each would merge into a single meaningless buzz; one
   * short pulse per interval reads as a series of distinct knocks.
   *
   * @param {number} energy Joules.
   * @param {number} [now] Milliseconds, injectable so tests need no clock.
   * @returns {boolean}
   */
  function impact(energy, now = Date.now()) {
    if (!supported || !enabled) return false;
    if (!(energy >= HAPTICS.MIN_ENERGY_J)) return false;
    if (now - lastAt < HAPTICS.MIN_INTERVAL_MS) return false;
    lastAt = now;

    // Square root, so a huge hit is clearly bigger than a medium one without the motor
    // simply saturating at the cap for everything above a moderate impact.
    const t = Math.min(1, Math.sqrt(energy / HAPTICS.FULL_STRENGTH_ENERGY_J));
    const ms = Math.round(
      HAPTICS.MIN_DURATION_MS + t * (HAPTICS.MAX_DURATION_MS - HAPTICS.MIN_DURATION_MS),
    );
    try {
      navigator.vibrate(ms);
    } catch {
      // Some browsers throw when the page is not visible or not user activated. A failed
      // buzz is never worth interrupting the game for.
      return false;
    }
    return true;
  }

  /** A short double pulse when a level is cleared. */
  function levelClear() {
    if (!supported || !enabled) return;
    try {
      navigator.vibrate(HAPTICS.CLEAR_PATTERN_MS);
    } catch { /* not worth interrupting the game for */ }
  }

  /** Stops any buzz in progress. Called when the game is paused or a level is torn down. */
  function stop() {
    if (!supported) return;
    try {
      navigator.vibrate(0);
    } catch { /* nothing to stop */ }
  }

  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) stop();
  }

  return {
    impact,
    levelClear,
    stop,
    setEnabled,
    get available() { return supported; },
    get enabled() { return enabled; },
  };
}
