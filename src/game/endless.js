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

/** Pieces that can carry a structure, with their heights. */
const SUPPORTS = [
  { id: 'S02_SHORT_COLUMN', height: 2 },
  { id: 'S01_ROUND_COLUMN', height: 3 },
  { id: 'S03_WIDE_FOOTING', height: 0.5 },
];

/**
 * Generates one endless round.
 *
 * Difficulty rises with `round`: more rows, wider spans and tougher default families as
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

  // The structure grows for the first dozen rounds, then stops growing and starts
  // getting denser, so that round 40 is harder than round 20 without being twice as big
  // and walking past the body budget.
  const rows = Math.min(7, 2 + Math.floor(round / 3));
  const halfWidth = Math.min(6, 2.5 + round * 0.12);

  const support = SUPPORTS[Math.floor(rnd() * SUPPORTS.length)];
  const legSpan = Math.max(1.2, halfWidth - 0.6);
  pieces.push({ piece: support.id, x: -round1(legSpan), y: 0, support: true });
  pieces.push({ piece: support.id, x: round1(legSpan), y: 0, support: true });
  const baseY = support.height;

  // A deck across the legs, so the rows above have something to stand on.
  const deckSpan = legSpan * 2;
  let deckX = -deckSpan / 2;
  while (deckX < deckSpan / 2 - 0.01 && pieces.length < LEVEL.MAX_PIECES) {
    const beam = deckX + 4 <= deckSpan / 2 ? ROW_PIECES[3] : ROW_PIECES[1];
    if (deckX + beam.width > deckSpan / 2 + 0.01) break;
    pieces.push({ piece: beam.id, x: round1(deckX + beam.width / 2), y: round1(baseY) });
    deckX += beam.width;
  }

  for (let row = 0; row < rows && pieces.length < LEVEL.MAX_PIECES; row += 1) {
    let x = -halfWidth;
    const y = baseY + 1 + row;
    while (x < halfWidth - 0.01 && pieces.length < LEVEL.MAX_PIECES) {
      const choice = ROW_PIECES[Math.floor(rnd() * ROW_PIECES.length)];
      if (x + choice.width > halfWidth) {
        // Fall back to the narrowest piece, and give up on the row if even that will
        // not fit, so the loop always terminates.
        if (x + 1 > halfWidth) break;
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
    // Par grows more slowly than the structure, so endless mode gets harder.
    par: Math.max(3, Math.round(4 + round * 0.55)),
    pieces: pieces.slice(0, LEVEL.MAX_PIECES),
  };
}

function round1(n) {
  return Math.round(n * 100) / 100;
}
