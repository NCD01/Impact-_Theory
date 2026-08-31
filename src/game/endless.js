/**
 * endless.js
 *
 * OWNS: generating structures for endless mode, from a seed.
 *
 * MUST NOT OWN: a second level format. It emits the exact schema src/game/level.js
 * validates, and the generated level goes through the same validator and the same loader
 * a hand designed one does. If endless mode ever needs its own format, the format is
 * wrong.
 *
 * Seeded, so a given round number always produces the same structure. That makes a run
 * reproducible, makes a bug in a generated level reportable by its number, and lets the
 * test suite assert the generator never emits an illegal level.
 */

import { LEVEL } from '../core/constants.js';
import { LEVEL_SCHEMA_VERSION } from './level.js';

/**
 * Deterministic pseudo random number generator, mulberry32.
 *
 * Chosen because it is four lines, has no state beyond one integer, and gives the same
 * sequence in every JavaScript engine. Math.random cannot be seeded and is therefore
 * useless for anything reproducible.
 *
 * @param {number} seed
 * @returns {() => number} Values in [0, 1).
 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pieces the generator builds rows from. All 1 SU tall, so rows sit flush. */
const ROW_PIECES = [
  { id: 'B01_SMALL_BLOCK', width: 1 },
  { id: 'B02_MEDIUM_BLOCK', width: 2 },
  { id: 'S04_WEDGE', width: 2 },
  { id: 'B03_LONG_BEAM', width: 4 },
];

/**
 * Total height of a pedestal, SU. Must match PEDESTAL_HEIGHT in src/game/pedestal.js.
 * Restated rather than imported so this module stays free of rendering code and can be
 * unit tested in Node. A test asserts the two agree.
 */
const PEDESTAL_HEIGHT = 1.6;

/** Thickness of the fixed deck. Must match DECK_THICKNESS in src/game/pedestal.js. */
const DECK_THICKNESS = 0.5;

/**
 * The two base arrangements the generator uses, matching the hand designed levels.
 *
 * Each has pedestals under both sides of every deck beam's centre, which is what stops a
 * beam teetering on a single plinth.
 */
const BASES = {
  pair: { xs: [-1.5, 1.5], width: 4 },
  triple: { xs: [-3, 0, 3], width: 8 },
};

/**
 * Generates one endless round.
 *
 * Difficulty rises with `round`: more rows, a wider base and tougher default families as
 * the run goes on. Capped at LEVEL.MAX_PIECES so a long run cannot walk past the body
 * budget measured in phase 3.
 *
 * Assumes `round` is a positive integer. Returns a level object in the standard schema,
 * which the caller should still pass through the validator; the test suite does exactly
 * that for the first two hundred rounds.
 *
 * @param {number} round
 * @param {number} [seed] Defaults to the round, so a round is reproducible by number.
 * @returns {object} A level in the standard schema.
 */
export function generateEndlessLevel(round, seed = round) {
  const rnd = seededRandom(seed * 2654435761);
  const pieces = [];

  // The narrow base for the opening rounds, the wide one afterwards.
  const base = round < 4 ? BASES.pair : BASES.triple;
  // The deck is fixed scenery placed by the game, so the structure simply starts on top
  // of it. Nothing here places a deck piece.
  const topY = PEDESTAL_HEIGHT + DECK_THICKNESS;

  // Rows on top. Grows for the first dozen rounds, then stops growing and gets denser,
  // so round 40 is harder than round 20 without being twice as big.
  const rows = Math.min(6, 1 + Math.floor(round / 3));
  const half = base.width / 2;

  for (let r = 0; r < rows && pieces.length < LEVEL.MAX_PIECES; r += 1) {
    const y = topY + r;
    let x = -half;
    while (x < half - 0.01 && pieces.length < LEVEL.MAX_PIECES) {
      const choice = ROW_PIECES[Math.floor(rnd() * ROW_PIECES.length)];
      if (x + choice.width > half + 0.01) {
        // Fall back to the narrowest piece, and give up on the row if even that will not
        // fit, so the loop always terminates.
        if (x + 1 > half + 0.01) break;
        pieces.push({ piece: ROW_PIECES[0].id, x: round1(x + 0.5), y: round1(y) });
        x += 1;
        continue;
      }
      const spec = { piece: choice.id, x: round1(x + choice.width / 2), y: round1(y) };
      // Tougher materials appear as the run goes on, and only ever as an override on a
      // piece that already exists, so nothing about the format changes.
      const toughness = rnd();
      if (round > 6 && toughness > 0.82) spec.family = 'stone';
      else if (round > 3 && toughness > 0.7) spec.family = 'concrete';
      pieces.push(spec);
      x += choice.width;
    }
  }

  return {
    schema: LEVEL_SCHEMA_VERSION,
    id: round,
    name: `Round ${round}`,
    // Par follows the piece count, the same rule the hand designed levels use, because
    // the work of clearing a level scales with how many pieces have to come down.
    par: Math.max(3, Math.round(Math.min(pieces.length, LEVEL.MAX_PIECES) * 0.9) + 2),
    pedestals: base.xs,
    pieces: pieces.slice(0, LEVEL.MAX_PIECES),
  };
}

function round1(n) {
  return Math.round(n * 100) / 100;
}
