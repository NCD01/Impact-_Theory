/**
 * verify-level-support.mjs
 *
 * OWNS: checking that no shipped level places a piece with nothing under it.
 *
 * MUST NOT OWN: the level schema, or physics. It reads the emitted JSON and the block
 * manifest and does arithmetic on rectangles.
 *
 * Why it exists. The first thirty levels shipped with 26 pieces either floating in mid air
 * or balanced on one edge of a pedestal, and the owner spotted it in the first screenshot
 * he looked at. A level that looks broken while standing still is worse than a hard level.
 *
 * What counts as supported. A beam resting on two pedestals is only a quarter covered and
 * is perfectly correct: that is a span, and the reference clip is full of them. Two cases
 * are wrong:
 *
 *   FLOATING   nothing at all beneath the piece
 *   TEETERING  support on only one side of the piece's centre, so it topples on contact
 *
 * Pedestals count as ground. They are fixed scenery placed by the game rather than pieces,
 * so they are modelled here as immovable blocks of cap width standing at each declared x.
 *
 * Run: node scripts/verify-level-support.mjs
 * Exits non-zero if anything is wrong, so the unit suite and CI can gate on it.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const LEVELS = path.join(REPO_ROOT, 'levels');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(REPO_ROOT, 'Assets', 'Art', 'Blocks', 'block_asset_manifest.json'), 'utf8',
));
const DIM = Object.fromEntries(MANIFEST.pieces.map((p) => [p.id, p]));

/** Must match src/game/pedestal.js. A unit test asserts they agree. */
const PEDESTAL_HEIGHT = 1.6;
const DECK_THICKNESS = 0.5;
const DECK_OVERHANG = 1;
const PLATFORM_TOP = PEDESTAL_HEIGHT + DECK_THICKNESS;

/** The horizontal extent and vertical span a piece occupies. */
function extents(spec) {
  const d = DIM[spec.piece];
  const bottom = spec.y + (d.pivot === 'geometric-center' ? -d.height / 2 : 0);
  return {
    x0: spec.x - d.width / 2,
    x1: spec.x + d.width / 2,
    bottom,
    top: bottom + d.height,
  };
}

/**
 * The platform, as one solid block from the sand up to the deck surface.
 *
 * The plinths and their deck are a single piece of fixed scenery as far as support goes,
 * so a structure standing anywhere along the deck is carried.
 */
function platformExtents(xs) {
  return {
    x0: Math.min(...xs) - DECK_OVERHANG,
    x1: Math.max(...xs) + DECK_OVERHANG,
    bottom: 0,
    top: PLATFORM_TOP,
  };
}

let totalBad = 0;

for (const file of fs.readdirSync(LEVELS).filter((n) => n.endsWith('.json')).sort()) {
  const level = JSON.parse(fs.readFileSync(path.join(LEVELS, file), 'utf8'));
  const pieceBoxes = level.pieces.map(extents);
  // Everything a piece could be standing on: other pieces, and the pedestals.
  const carriers = [...pieceBoxes];
  if (level.pedestals?.length) carriers.push(platformExtents(level.pedestals));

  const bad = [];
  level.pieces.forEach((spec, i) => {
    const e = pieceBoxes[i];
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
      bad.push(`FLOATING  ${spec.piece} at x=${spec.x} y=${spec.y}`);
    } else if (!(leftOfCentre && rightOfCentre) && fraction < 0.5) {
      bad.push(
        `TEETERING ${spec.piece} at x=${spec.x} y=${spec.y} `
        + `(${Math.round(fraction * 100)}% on one side)`,
      );
    }
  });

  if (bad.length > 0) {
    totalBad += bad.length;
    console.log(`${file}  ${level.name}`);
    for (const b of bad) console.log(`    ${b}`);
  }
}

if (totalBad === 0) {
  console.log('All levels supported: nothing floating, nothing teetering.');
  process.exit(0);
}
console.log(`\ntotal badly placed pieces: ${totalBad}`);
process.exit(1);
