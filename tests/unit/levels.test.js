/**
 * levels.test.js
 *
 * Covers: that every shipped level is legal against the schema, that the validator
 * actually rejects the things it claims to, and that the difficulty curve rises.
 *
 * The validator test matters more than the shipped level test. A validator that passes
 * everything would let all thirty levels pass while a piece id typo shipped, so each
 * rule is tested by feeding it a level that breaks exactly that rule.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLevel, assertValidLevel, summariseLevel, LEVEL_SCHEMA_VERSION } from '../../src/game/level.js';
import { LEVEL } from '../../src/core/constants.js';
import { PEDESTAL_HEIGHT, PEDESTAL_CAP_RADIUS } from '../../src/game/pedestal.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEVELS_DIR = path.join(REPO_ROOT, 'levels');

const files = fs.readdirSync(LEVELS_DIR).filter((f) => f.endsWith('.json')).sort();
const levels = files.map((f) => ({
  file: f,
  data: JSON.parse(fs.readFileSync(path.join(LEVELS_DIR, f), 'utf8')),
}));

/** A minimal level that is legal, used as the base for the rejection tests. */
function validLevel(overrides = {}) {
  return {
    schema: LEVEL_SCHEMA_VERSION,
    id: 1,
    name: 'Test',
    par: 3,
    pedestals: [0],
    pieces: [
      { piece: 'B01_SMALL_BLOCK', x: 0, y: 0 },
    ],
    ...overrides,
  };
}

describe('shipped levels', () => {
  it('ships exactly the configured number of levels', () => {
    expect(levels).toHaveLength(LEVEL.COUNT);
  });

  it.each(levels)('$file is legal against the schema', ({ file, data }) => {
    expect(validateLevel(data, file)).toEqual([]);
  });

  it('numbers levels 1 to 30 with no gaps and no duplicates', () => {
    const ids = levels.map((l) => l.data.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: LEVEL.COUNT }, (_, i) => i + 1));
  });

  it('gives every level a distinct name', () => {
    const names = levels.map((l) => l.data.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps every level inside the body budget from the phase 3 spike', () => {
    for (const { file, data } of levels) {
      expect(data.pieces.length, `${file} piece count`).toBeLessThanOrEqual(LEVEL.MAX_PIECES);
    }
  });

  it('gives every level at least one piece that has to be knocked down', () => {
    for (const { file, data } of levels) {
      expect(data.pieces.length, `${file} has no pieces`).toBeGreaterThan(0);
    }
  });

  it('raises par as the levels go on', () => {
    const pars = levels.sort((a, b) => a.data.id - b.data.id).map((l) => l.data.par);
    // Not strictly monotonic, because a level can be harder without needing more balls,
    // but the curve has to rise overall and never fall back to the opening par.
    expect(pars[0]).toBeLessThan(pars[pars.length - 1]);
    const firstThird = pars.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const lastThird = pars.slice(-10).reduce((a, b) => a + b, 0) / 10;
    expect(lastThird).toBeGreaterThan(firstThird);
  });

  it('never places a piece below the ground plane', () => {
    for (const { file, data } of levels) {
      for (const p of data.pieces) {
        expect(p.y, `${file} ${p.piece}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('summarises every level without throwing', () => {
    for (const { data } of levels) {
      const s = summariseLevel(data);
      expect(s.pieces).toBe(data.pieces.length);
      expect(s.height).toBeGreaterThan(0);
      expect(s.families.length).toBeGreaterThan(0);
    }
  });
});

describe('level validator', () => {
  it('accepts a legal level', () => {
    expect(validateLevel(validLevel())).toEqual([]);
  });

  it('rejects a piece id that is not in the block manifest', () => {
    const bad = validLevel({ pieces: [{ piece: 'B99_NOT_REAL', x: 0, y: 0 }] });
    expect(validateLevel(bad).join()).toMatch(/not a piece id/);
  });

  it('rejects a material family that does not exist', () => {
    const bad = validLevel({
      pieces: [{ piece: 'B01_SMALL_BLOCK', x: 0, y: 0, family: 'adamantium' }],
    });
    expect(validateLevel(bad).join()).toMatch(/not a material family/);
  });

  it('rejects the old support field, so a schema 1 level fails loudly', () => {
    const bad = validLevel({
      pieces: [{ piece: 'B01_SMALL_BLOCK', x: 0, y: 0, support: true }],
    });
    expect(validateLevel(bad).join()).toMatch(/no longer a piece field/);
  });

  it('rejects a level with no pieces to knock down', () => {
    expect(validateLevel(validLevel({ pieces: [] })).join()).toMatch(/non-empty array/);
  });

  it('rejects a pedestals array that is empty or not numbers', () => {
    expect(validateLevel(validLevel({ pedestals: [] })).join()).toMatch(/non-empty array/);
    expect(validateLevel(validLevel({ pedestals: ['x'] })).join()).toMatch(/finite number/);
  });

  it('rejects a wrong schema version', () => {
    expect(validateLevel(validLevel({ schema: 99 })).join()).toMatch(/schema must be/);
  });

  it('rejects a missing or empty name', () => {
    expect(validateLevel(validLevel({ name: '' })).join()).toMatch(/name must be/);
  });

  it('rejects a par that is not a positive integer', () => {
    expect(validateLevel(validLevel({ par: 0 })).join()).toMatch(/par must be/);
    expect(validateLevel(validLevel({ par: 2.5 })).join()).toMatch(/par must be/);
  });

  it('rejects a piece below the ground plane', () => {
    const bad = validLevel({ pieces: [{ piece: 'B01_SMALL_BLOCK', x: 0, y: -1 }] });
    expect(validateLevel(bad).join()).toMatch(/below the ground plane/);
  });

  it('rejects a non finite coordinate', () => {
    const bad = validLevel({ pieces: [{ piece: 'B01_SMALL_BLOCK', x: Infinity, y: 0 }] });
    expect(validateLevel(bad).join()).toMatch(/must be a finite number/);
  });

  it('rejects a level over the piece budget', () => {
    const many = Array.from({ length: LEVEL.MAX_PIECES + 1 }, (_, i) => ({
      piece: 'B01_SMALL_BLOCK', x: i, y: 0,
    }));
    expect(validateLevel(validLevel({ pieces: many })).join()).toMatch(/over the budget/);
  });

  it('rejects things that are not objects at all', () => {
    expect(validateLevel(null).join()).toMatch(/expected an object/);
    expect(validateLevel([]).join()).toMatch(/expected an object/);
    expect(validateLevel('a level').join()).toMatch(/expected an object/);
  });

  it('reports every problem at once rather than only the first', () => {
    const bad = { schema: 9, id: 0, name: '', par: -1, pieces: [] };
    expect(validateLevel(bad).length).toBeGreaterThanOrEqual(4);
  });

  it('assertValidLevel throws with every problem listed', () => {
    expect(() => assertValidLevel(validLevel({ par: 0, name: '' }))).toThrow(/Invalid level/);
  });
});

describe('level support', () => {
  /**
   * Every piece must have something under it.
   *
   * A beam resting on two pedestals is only a quarter covered and is correct: that is a
   * span. Two things are not correct, and both shipped in the first version of the levels
   * before the owner spotted them in the first screenshot he looked at:
   *
   *   floating   nothing at all beneath the piece
   *   teetering  support on only one side of the piece's centre, so it topples on contact
   *
   * `scripts/verify-level-support.mjs` runs the same check from the command line.
   */
  const dim = Object.fromEntries(
    JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'Assets', 'Art', 'Blocks', 'block_asset_manifest.json'), 'utf8',
    )).pieces.map((p) => [p.id, p]),
  );

  const extents = (spec) => {
    const d = dim[spec.piece];
    const bottom = spec.y + (d.pivot === 'geometric-center' ? -d.height / 2 : 0);
    return {
      x0: spec.x - d.width / 2,
      x1: spec.x + d.width / 2,
      bottom,
      top: bottom + d.height,
    };
  };

  /** A pedestal, as a solid block from the sand up to its cap. */
  const pedestalBox = (x) => ({
    x0: x - PEDESTAL_CAP_RADIUS,
    x1: x + PEDESTAL_CAP_RADIUS,
    bottom: 0,
    top: PEDESTAL_HEIGHT,
  });

  it.each(levels)('$file places nothing in mid air', ({ file, data }) => {
    const boxes = data.pieces.map(extents);
    // Pedestals count as ground: they are fixed scenery, not pieces.
    const carriers = [...boxes, ...(data.pedestals ?? []).map(pedestalBox)];
    const problems = [];

    data.pieces.forEach((spec, i) => {
      const e = boxes[i];
      if (e.bottom <= 0.01) return; // resting on the sand

      let covered = 0;
      let leftOfCentre = false;
      let rightOfCentre = false;
      carriers.forEach((o, j) => {
        if (j === i) return;
        if (Math.abs(o.top - e.bottom) > 0.06) return; // not directly beneath
        const lo = Math.max(e.x0, o.x0);
        const hi = Math.min(e.x1, o.x1);
        if (hi - lo <= 0.02) return;
        covered += hi - lo;
        if (lo < spec.x - 0.02) leftOfCentre = true;
        if (hi > spec.x + 0.02) rightOfCentre = true;
      });

      const fraction = covered / (e.x1 - e.x0);
      if (fraction < 0.02) {
        problems.push(`${spec.piece} at x=${spec.x} y=${spec.y} is floating`);
      } else if (!(leftOfCentre && rightOfCentre) && fraction < 0.5) {
        problems.push(
          `${spec.piece} at x=${spec.x} y=${spec.y} is supported on one side only `
          + `(${Math.round(fraction * 100)}%)`,
        );
      }
    });

    expect(problems, `${file} has badly placed pieces`).toEqual([]);
  });

  it('gives every level at least one pedestal to stand on', () => {
    for (const { file, data } of levels) {
      expect(Array.isArray(data.pedestals), `${file} has no pedestals array`).toBe(true);
      expect(data.pedestals.length, `${file} has no pedestals`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the pedestal height in the authoring script and the game in step', () => {
    // author-levels.mjs and verify-level-support.mjs both restate PEDESTAL_HEIGHT rather
    // than importing it, because they run in plain Node and importing the game module
    // would pull in three.js. This is the test that stops the two drifting apart.
    const authoring = fs.readFileSync(
      path.join(REPO_ROOT, 'scripts', 'author-levels.mjs'), 'utf8',
    ).match(/const PEDESTAL_HEIGHT = ([\d.]+)/);
    expect(authoring, 'author-levels.mjs no longer declares PEDESTAL_HEIGHT').not.toBeNull();
    expect(Number(authoring[1])).toBe(PEDESTAL_HEIGHT);
  });
});
