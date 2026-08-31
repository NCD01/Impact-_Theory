/**
 * damage.js
 *
 * OWNS: the rule that turns impact energy into damage, and the bookkeeping of how much
 * punishment a piece has taken.
 *
 * MUST NOT OWN: anything that touches Rapier, three.js or the DOM. This module is pure
 * arithmetic on purpose, so the damage model can be unit tested without starting a
 * physics world, and so the rule can be read in one place rather than inferred from a
 * collision handler.
 *
 * The model. A piece has hit points measured in joules. Each impact contributes its
 * kinetic energy, above a floor, to an accumulator. When the accumulator reaches the
 * piece's hit points, the piece fractures.
 *
 * Energy rather than hit count is the whole point. A ball that clips the corner of a
 * beam carries a fraction of the energy of one that hits it square, and the two are
 * different events. A hit counter cannot tell them apart, so a game built on one
 * rewards spraying shots rather than aiming them.
 *
 * The floor exists because a settled stack presses on itself constantly. Without it a
 * structure grinds itself to death while nobody is shooting, which reads as pieces
 * spontaneously exploding.
 */

import { DESTRUCTION } from '../core/constants.js';

/**
 * Creates a damage accumulator for one piece.
 *
 * @param {number} hitPoints Joules the piece can absorb before it fractures.
 * @returns {{absorbed: number, hitPoints: number, destroyed: boolean}}
 */
export function createDamageState(hitPoints) {
  return { absorbed: 0, hitPoints, destroyed: false };
}

/**
 * Applies one impact to a damage state.
 *
 * Assumes `energy` is joules from the physics layer, and `damageScale` is the
 * difficulty multiplier (1 on Normal, higher on Easy so hits land harder). Impacts
 * below the floor are ignored entirely and do not even count as a graze.
 *
 * Returns what happened, so the caller can drive feedback without re-deriving it:
 * `applied` is the energy that actually counted, `fractured` is true on the impact that
 * takes the piece past its hit points, and `fraction` is how far through its life the
 * piece now is, which drives the damage tint.
 *
 * Mutates `state`. Calling this on an already destroyed piece is a no-op rather than an
 * error, because a collapse can deliver two impacts to the same piece in one step.
 *
 * @param {{absorbed: number, hitPoints: number, destroyed: boolean}} state
 * @param {number} energy
 * @param {number} [damageScale]
 * @returns {{applied: number, fractured: boolean, fraction: number}}
 */
export function applyImpact(state, energy, damageScale = 1) {
  if (state.destroyed) return { applied: 0, fractured: false, fraction: 1 };
  if (!(energy > DESTRUCTION.MIN_DAMAGE_ENERGY_J)) {
    return { applied: 0, fractured: false, fraction: damageFraction(state) };
  }

  const applied = energy * damageScale;
  state.absorbed += applied;

  const fractured = state.absorbed >= state.hitPoints;
  if (fractured) state.destroyed = true;

  return { applied, fractured, fraction: damageFraction(state) };
}

/**
 * How far through its hit points a piece is, 0 to 1.
 * @param {{absorbed: number, hitPoints: number}} state
 * @returns {number}
 */
export function damageFraction(state) {
  if (state.hitPoints <= 0) return 1;
  return Math.min(1, state.absorbed / state.hitPoints);
}

/**
 * Kinetic energy of a mass moving at a speed, joules.
 *
 * Provided so callers state the physics rather than open coding 0.5 m v squared, and so
 * the tests can build expected values from the same function the game uses.
 *
 * @param {number} massKg
 * @param {number} speed SU per second, which is metres per second.
 * @returns {number}
 */
export function kineticEnergy(massKg, speed) {
  return 0.5 * massKg * speed * speed;
}

/**
 * Reduced mass of a two body collision, kilograms.
 *
 * Pass Infinity for a fixed body, such as the ground, and the result is the other
 * body's mass, which is the physically correct limit.
 *
 * @param {number} m1
 * @param {number} m2
 * @returns {number}
 */
export function reducedMass(m1, m2) {
  if (!Number.isFinite(m1)) return m2;
  if (!Number.isFinite(m2)) return m1;
  return (m1 * m2) / (m1 + m2);
}
