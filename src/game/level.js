/**
 * level.js
 *
 * OWNS: the level file format, its validator, and loading a level's data. One schema
 * serves hand designed levels and endless mode alike, so there is exactly one format to
 * validate, one to document and one to load.
 *
 * MUST NOT OWN: placing pieces in a world (src/game/structure.js), scoring
 * (src/game/scoring.js), or progress (src/save/save.js).
 *
 * The format is documented field by field in docs/LEVEL_FORMAT.md with a worked
 * example. This file is the authority on what is legal; that document describes it.
 *
 * The validator returns errors rather than throwing, and reports every problem it finds
 * rather than the first, because a level author fixing thirty levels wants the whole
 * list. The unit suite runs it over every shipped level, so a level with a piece id
 * that is not in the block manifest fails the test suite instead of loading into an
 * empty playfield.
 */

import { hasPiece, getPiece } from '../blocks/manifest.js';
import { FAMILIES, SUPPORT_CAPABLE_PIECES } from '../blocks/families.js';
import { LEVEL } from '../core/constants.js';

/**
 * The schema version this build writes and reads.
 *
 * A level file carrying a higher number is rejected rather than guessed at. Levels ship
 * inside the build, so unlike a save file there is never an old level to migrate: if
 * this number changes, every shipped level changes with it in the same commit.
 */
export const LEVEL_SCHEMA_VERSION = 1;

/**
 * Validates one level object.
 *
 * Assumes nothing about `data`; it may be anything at all, including null, because this
 * also validates files produced by the endless generator and by hand editing. Returns
 * every problem found, so an author sees the whole list at once. An empty array means
 * the level is legal and safe to load.
 *
 * @param {unknown} data
 * @param {string} [source] Where the level came from, used in messages.
 * @returns {string[]} Problems, empty when valid.
 */
export function validateLevel(data, source = 'level') {
  const errors = [];
  const err = (msg) => errors.push(`${source}: ${msg}`);

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [`${source}: expected an object, got ${Array.isArray(data) ? 'an array' : typeof data}`];
  }

  if (data.schema !== LEVEL_SCHEMA_VERSION) {
    err(`schema must be ${LEVEL_SCHEMA_VERSION}, got ${JSON.stringify(data.schema)}`);
  }
  if (!Number.isInteger(data.id) || data.id < 1) {
    err(`id must be a positive integer, got ${JSON.stringify(data.id)}`);
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    err('name must be a non-empty string');
  }
  if (!Number.isInteger(data.par) || data.par < 1) {
    err(`par must be a positive integer, got ${JSON.stringify(data.par)}`);
  }

  if (!Array.isArray(data.pieces) || data.pieces.length === 0) {
    err('pieces must be a non-empty array');
    return errors;
  }
  if (data.pieces.length > LEVEL.MAX_PIECES) {
    err(
      `has ${data.pieces.length} pieces, over the budget of ${LEVEL.MAX_PIECES}. `
      + 'The cap comes from the phase 3 body budget spike, see docs/DECISIONS.md D-006.',
    );
  }

  let targets = 0;
  data.pieces.forEach((p, i) => {
    const at = `pieces[${i}]`;
    if (typeof p !== 'object' || p === null) {
      err(`${at} must be an object`);
      return;
    }
    if (typeof p.piece !== 'string' || !hasPiece(p.piece)) {
      err(`${at}.piece ${JSON.stringify(p.piece)} is not a piece id in block_asset_manifest.json`);
      return;
    }
    for (const axis of ['x', 'y']) {
      if (!Number.isFinite(p[axis])) err(`${at}.${axis} must be a finite number`);
    }
    if (p.z !== undefined && !Number.isFinite(p.z)) err(`${at}.z must be a finite number`);
    if (p.rotY !== undefined && !Number.isFinite(p.rotY)) err(`${at}.rotY must be a finite number`);
    if (p.y < 0) err(`${at}.y is ${p.y}, below the ground plane`);

    if (p.family !== undefined && !Object.hasOwn(FAMILIES, p.family)) {
      err(
        `${at}.family ${JSON.stringify(p.family)} is not a material family. `
        + `Known: ${Object.keys(FAMILIES).join(', ')}`,
      );
    }
    if (p.support !== undefined && typeof p.support !== 'boolean') {
      err(`${at}.support must be true or false`);
    }
    if (p.support === true && !SUPPORT_CAPABLE_PIECES.has(p.piece)) {
      err(
        `${at} marks ${p.piece} as a support, but only `
        + `${[...SUPPORT_CAPABLE_PIECES].join(', ')} may be supports`,
      );
    }
    if (p.fixed !== undefined && typeof p.fixed !== 'boolean') {
      err(`${at}.fixed must be true or false`);
    }
    if (p.support !== true) targets += 1;
  });

  if (targets === 0) {
    err('has no non support pieces, so it would be cleared the instant it loads');
  }

  return errors;
}

/**
 * Validates a level and throws on the first problem, for callers that cannot continue.
 *
 * Used by the level loader at runtime. The test suite calls validateLevel directly so it
 * can report every problem in every level at once.
 *
 * @param {unknown} data
 * @param {string} [source]
 * @returns {object} The same object, now known to be legal.
 */
export function assertValidLevel(data, source = 'level') {
  const errors = validateLevel(data, source);
  if (errors.length > 0) {
    throw new Error(`Invalid level.\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return data;
}

/**
 * Summarises a level without loading it, for the level select screen.
 *
 * Assumes the level has already been validated. The highest piece top is computed from
 * the manifest rather than measured in a physics world, so the level select can show a
 * level's size without simulating it.
 *
 * @param {object} level
 * @returns {{id: number, name: string, par: number, pieces: number,
 *            supports: number, height: number, width: number, families: string[]}}
 */
export function summariseLevel(level) {
  let height = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let supports = 0;
  const families = new Set();

  for (const spec of level.pieces) {
    const piece = getPiece(spec.piece);
    // A geometric-center piece straddles its origin, so its top is half a height up.
    const top = spec.y + (piece.pivot === 'geometric-center' ? piece.height / 2 : piece.height);
    if (top > height) height = top;
    // Width counts the piece's own extent, not just its origin. A 4 SU beam centred at
    // the edge of a level reaches 2 SU further than its origin says, and framing that
    // ignores it puts half the beam off screen.
    if (spec.x - piece.width / 2 < minX) minX = spec.x - piece.width / 2;
    if (spec.x + piece.width / 2 > maxX) maxX = spec.x + piece.width / 2;
    if (spec.support === true) supports += 1;
    families.add(spec.family ?? piece.defaultFamily);
  }

  return {
    id: level.id,
    name: level.name,
    par: level.par,
    pieces: level.pieces.length,
    supports,
    height: Math.round(height * 100) / 100,
    width: Math.round((maxX - minX) * 100) / 100,
    families: [...families].sort(),
  };
}

/**
 * Loads every shipped level, in id order.
 *
 * Levels are bundled at build time with Vite's glob import rather than fetched, so a
 * malformed or missing level is a build error rather than a blank screen mid game, and
 * so the level select can show every level without thirty network requests.
 *
 * Throws if any level fails validation, naming the file. That is deliberate: shipping a
 * broken level is worse than failing to start, and the unit suite catches it first.
 *
 * @returns {object[]}
 */
export function loadShippedLevels() {
  const modules = import.meta.glob('../../levels/*.json', { eager: true, import: 'default' });
  const levels = [];
  for (const [path, data] of Object.entries(modules)) {
    assertValidLevel(data, path);
    levels.push(data);
  }
  levels.sort((a, b) => a.id - b.id);
  return levels;
}
