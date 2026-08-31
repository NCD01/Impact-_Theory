/**
 * scoring.test.js
 *
 * Covers: piece values by material family, the combo window, the star bands on both
 * difficulties, the ball allowance, and the damage model that decides when a piece is
 * destroyed at all.
 *
 * Time is passed in rather than read from a clock, so a whole combo chain can be driven
 * in a single synchronous test and the result is the same every run.
 */

import { describe, expect, it } from 'vitest';

import { createScoring, starsFor, ballAllowance } from '../../src/game/scoring.js';
import { DIFFICULTY, SCORING, STARS, DESTRUCTION } from '../../src/core/constants.js';
import { FAMILIES } from '../../src/blocks/families.js';
import {
  createDamageState, applyImpact, damageFraction, kineticEnergy, reducedMass,
} from '../../src/physics/damage.js';

const NORMAL = DIFFICULTY.normal;
const EASY = DIFFICULTY.easy;

describe('piece scoring', () => {
  it('pays the base value times the family weight for a single piece', () => {
    const s = createScoring(NORMAL, 5);
    const r = s.pieceDestroyed('wood', 0);
    expect(r.multiplier).toBe(1);
    expect(r.points).toBe(Math.round(SCORING.BASE_PIECE_POINTS * FAMILIES.wood.scoreWeight));
  });

  it('pays more for a tougher family', () => {
    const a = createScoring(NORMAL, 5).pieceDestroyed('wood', 0).points;
    const b = createScoring(NORMAL, 5).pieceDestroyed('steel', 0).points;
    expect(b).toBeGreaterThan(a);
  });
});

describe('combos', () => {
  it('raises the multiplier for pieces destroyed inside the window', () => {
    const s = createScoring(NORMAL, 5);
    const first = s.pieceDestroyed('wood', 0);
    const second = s.pieceDestroyed('wood', 0.3);
    const third = s.pieceDestroyed('wood', 0.6);
    expect(first.multiplier).toBe(1);
    expect(second.multiplier).toBe(1 + SCORING.COMBO_STEP);
    expect(third.multiplier).toBe(1 + 2 * SCORING.COMBO_STEP);
    expect(third.combo).toBe(3);
  });

  it('starts a new chain once the window lapses', () => {
    const s = createScoring(NORMAL, 5);
    s.pieceDestroyed('wood', 0);
    s.pieceDestroyed('wood', 0.2);
    const after = s.pieceDestroyed('wood', 0.2 + SCORING.COMBO_WINDOW_S + 0.01);
    expect(after.combo).toBe(1);
    expect(after.multiplier).toBe(1);
  });

  it('caps the multiplier so one collapse cannot dwarf every other score', () => {
    const s = createScoring(NORMAL, 5);
    let last;
    for (let i = 0; i < 40; i += 1) last = s.pieceDestroyed('wood', i * 0.1);
    expect(last.multiplier).toBe(SCORING.COMBO_MAX_MULTIPLIER);
  });

  it('remembers the best combo of the run', () => {
    const s = createScoring(NORMAL, 5);
    s.pieceDestroyed('wood', 0);
    s.pieceDestroyed('wood', 0.2);
    s.pieceDestroyed('wood', 0.4);
    s.pieceDestroyed('wood', 10);
    expect(s.bestCombo).toBe(3);
  });
});

describe('finishing a level', () => {
  it('pays a bonus for balls not used, on a limited difficulty', () => {
    const s = createScoring(NORMAL, 6);
    s.pieceDestroyed('wood', 0);
    const before = s.score;
    const result = s.finish(4, false);
    expect(result.bonus).toBe(2 * SCORING.BALL_SAVED_POINTS);
    expect(result.score).toBe(before + result.bonus);
  });

  it('pays no ball bonus when balls are unlimited, because none were saved', () => {
    const s = createScoring(EASY, 6);
    s.pieceDestroyed('wood', 0);
    expect(s.finish(20, true).bonus).toBe(0);
  });

  it('never pays a negative bonus for going over par', () => {
    const s = createScoring(NORMAL, 3);
    expect(s.finish(99, false).bonus).toBe(0);
  });
});

describe('stars', () => {
  it('gives three stars for clearing at or under par on Normal', () => {
    expect(starsFor(5, 5, STARS.NORMAL)).toBe(3);
    expect(starsFor(3, 5, STARS.NORMAL)).toBe(3);
  });

  it('gives two stars within the slack band', () => {
    expect(starsFor(7, 5, STARS.NORMAL)).toBe(2);
  });

  it('gives one star for clearing at all, never zero', () => {
    expect(starsFor(500, 5, STARS.NORMAL)).toBe(1);
    expect(starsFor(500, 5, STARS.EASY)).toBe(1);
  });

  it('is more forgiving on Easy than on Normal for the same run', () => {
    const ballsUsed = 7;
    const par = 5;
    expect(starsFor(ballsUsed, par, STARS.EASY))
      .toBeGreaterThanOrEqual(starsFor(ballsUsed, par, STARS.NORMAL));
  });
});

describe('ball allowance', () => {
  it('is unlimited on Easy, so there is no fail state', () => {
    expect(ballAllowance(EASY, 6)).toBeNull();
    expect(EASY.canFail).toBe(false);
  });

  it('is par plus a margin on Normal, and Normal can be failed', () => {
    // Par is the three star target, not the hard limit. Giving exactly par made every
    // level past the third unwinnable, because clearing means knocking every piece off.
    expect(ballAllowance(NORMAL, 6)).toBe(6 + NORMAL.ballLimitFromPar);
    expect(NORMAL.ballLimitFromPar).toBeGreaterThan(0);
    expect(NORMAL.canFail).toBe(true);
  });

  it('changes tuning only, never the code path', () => {
    // Both difficulties carry the same keys, so nothing branches on which one is active.
    expect(Object.keys(EASY).sort()).toEqual(Object.keys(NORMAL).sort());
  });
});

describe('damage model', () => {
  it('ignores impacts below the floor, so a settling stack does not grind itself apart', () => {
    const state = createDamageState(1000);
    const r = applyImpact(state, DESTRUCTION.MIN_DAMAGE_ENERGY_J - 1);
    expect(r.applied).toBe(0);
    expect(state.absorbed).toBe(0);
    expect(r.fractured).toBe(false);
  });

  it('accumulates energy rather than counting hits', () => {
    const state = createDamageState(1000);
    applyImpact(state, 400);
    applyImpact(state, 400);
    expect(state.destroyed).toBe(false);
    expect(damageFraction(state)).toBeCloseTo(0.8, 5);
    const third = applyImpact(state, 400);
    expect(third.fractured).toBe(true);
    expect(state.destroyed).toBe(true);
  });

  it('treats a graze and a square hit as different events', () => {
    const graze = createDamageState(10000);
    const square = createDamageState(10000);
    applyImpact(graze, 200);
    applyImpact(square, 9000);
    expect(damageFraction(square)).toBeGreaterThan(damageFraction(graze) * 10);
  });

  it('applies the difficulty damage scale', () => {
    const state = createDamageState(1000);
    applyImpact(state, 400, 2);
    expect(state.absorbed).toBe(800);
  });

  it('is a no-op on an already destroyed piece', () => {
    const state = createDamageState(100);
    applyImpact(state, 500);
    const again = applyImpact(state, 500);
    expect(again.applied).toBe(0);
    expect(again.fractured).toBe(false);
  });

  it('computes kinetic energy and reduced mass the way the physics layer does', () => {
    expect(kineticEnergy(100, 10)).toBe(5000);
    expect(reducedMass(2, 2)).toBe(1);
    // A fixed body behaves as infinite mass, so the pair's reduced mass is the mover's.
    expect(reducedMass(50, Infinity)).toBe(50);
    expect(reducedMass(Infinity, 50)).toBe(50);
  });

  it('gives a family with more hit points a longer life against the same impacts', () => {
    // Both survive a single square hit, which is the whole design: the game is about
    // knocking pieces off rather than deleting them where they stand. What differs is how
    // much punishment each has absorbed by then.
    const wood = createDamageState(FAMILIES.wood.hitPoints);
    const steel = createDamageState(FAMILIES.steel.hitPoints);
    applyImpact(wood, 80000);
    applyImpact(steel, 80000);
    expect(wood.destroyed).toBe(false);
    expect(steel.destroyed).toBe(false);
    expect(damageFraction(wood)).toBeGreaterThan(damageFraction(steel));
  });

  it('destroys a piece that is hit repeatedly, which is the other half of the design', () => {
    const wood = createDamageState(FAMILIES.wood.hitPoints);
    let hits = 0;
    while (!wood.destroyed && hits < 20) {
      applyImpact(wood, 80000);
      hits += 1;
    }
    expect(wood.destroyed).toBe(true);
    // Several square hits, not one and not twenty. Keep hitting it and it goes.
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(8);
  });
});
