/**
 * endless.test.js
 *
 * Covers: that the endless generator emits the same level schema hand designed levels
 * use, that it is reproducible from a seed, that it never emits an illegal level, and
 * that it stays inside the body budget however long a run goes on.
 *
 * The two hundred round sweep is the point of this file. A generator that produces a
 * legal level for round 1 and an illegal one for round 137 is a bug nobody finds until a
 * child has played for twenty minutes.
 */

import { describe, expect, it } from 'vitest';

import { generateEndlessLevel, seededRandom } from '../../src/game/endless.js';
import { validateLevel, LEVEL_SCHEMA_VERSION, summariseLevel } from '../../src/game/level.js';
import { LEVEL } from '../../src/core/constants.js';

describe('seeded random', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRandom(12345);
    const b = seededRandom(12345);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(first).toEqual(second);
  });

  it('produces a different sequence for a different seed', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect(a()).not.toBe(b());
  });

  it('stays inside zero to one', () => {
    const r = seededRandom(99);
    for (let i = 0; i < 500; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('endless generator', () => {
  it('emits the same schema a hand designed level uses', () => {
    const level = generateEndlessLevel(1);
    expect(level.schema).toBe(LEVEL_SCHEMA_VERSION);
    expect(validateLevel(level, 'endless 1')).toEqual([]);
  });

  it('produces a legal level for two hundred consecutive rounds', () => {
    const problems = [];
    for (let round = 1; round <= 200; round += 1) {
      const errors = validateLevel(generateEndlessLevel(round), `endless round ${round}`);
      if (errors.length) problems.push(...errors);
    }
    expect(problems).toEqual([]);
  });

  it('never exceeds the body budget, however long the run', () => {
    for (let round = 1; round <= 200; round += 1) {
      const level = generateEndlessLevel(round);
      expect(level.pieces.length, `round ${round}`).toBeLessThanOrEqual(LEVEL.MAX_PIECES);
    }
  });

  it('is reproducible: the same round gives the same structure every time', () => {
    for (const round of [1, 7, 42]) {
      expect(generateEndlessLevel(round)).toEqual(generateEndlessLevel(round));
    }
  });

  it('gives different rounds different structures', () => {
    const a = JSON.stringify(generateEndlessLevel(3).pieces);
    const b = JSON.stringify(generateEndlessLevel(4).pieces);
    expect(a).not.toBe(b);
  });

  it('grows harder as the rounds go on', () => {
    const early = generateEndlessLevel(1);
    const late = generateEndlessLevel(30);
    expect(late.pieces.length).toBeGreaterThan(early.pieces.length);
    expect(late.par).toBeGreaterThan(early.par);
  });

  it('always stands on pedestals and always has something to knock down', () => {
    for (let round = 1; round <= 60; round += 1) {
      const level = generateEndlessLevel(round);
      expect(level.pedestals.length, `round ${round} pedestals`).toBeGreaterThan(0);
      expect(level.pieces.length, `round ${round} pieces`).toBeGreaterThan(0);
    }
  });

  it('stays inside the frame the camera can show', () => {
    // The camera framing places a structure by its height and width. A generated level
    // wider than the widest hand designed one would be pushed past the fog.
    for (let round = 1; round <= 200; round += 1) {
      const s = summariseLevel(generateEndlessLevel(round));
      expect(s.width, `round ${round} width`).toBeLessThanOrEqual(14);
      expect(s.height, `round ${round} height`).toBeLessThanOrEqual(14);
    }
  });
});

describe('level framing inputs', () => {
  it('measures width from piece extents, not piece origins', () => {
    // A single 4 SU beam centred at the origin spans 4 SU, not 0.
    const level = {
      schema: LEVEL_SCHEMA_VERSION,
      id: 1,
      name: 'Width probe',
      par: 1,
      pieces: [{ piece: 'B03_LONG_BEAM', x: 0, y: 0 }],
    };
    expect(summariseLevel(level).width).toBe(4);
  });

  it('measures height to the top of a geometric-center piece correctly', () => {
    const level = {
      schema: LEVEL_SCHEMA_VERSION,
      id: 1,
      name: 'Height probe',
      par: 1,
      // A03_CROSS_BEAM is 3 SU tall with its origin at its middle, so placed at y = 3
      // its top is at 4.5, not 6.
      pieces: [{ piece: 'A03_CROSS_BEAM', x: 0, y: 3 }],
    };
    expect(summariseLevel(level).height).toBe(4.5);
  });
});
