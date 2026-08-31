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
 * Run: node scripts/verify-level-support.mjs
 * Exits non-zero if anything is wrong, so the unit suite and CI can gate on it.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const man = JSON.parse(fs.readFileSync(
  path.join(REPO_ROOT, 'Assets/Art/Blocks/block_asset_manifest.json'), 'utf8'));
const D = Object.fromEntries(man.pieces.map(p => [p.id, p]));

function extents(spec) {
  const d = D[spec.piece];
  const bottom = spec.y + (d.pivot === 'geometric-center' ? -d.height / 2 : 0);
  return { x0: spec.x - d.width / 2, x1: spec.x + d.width / 2, bottom, top: bottom + d.height };
}

let totalBad = 0;
const LEVELS = path.join(REPO_ROOT, 'levels');
for (const f of fs.readdirSync(LEVELS).filter((n) => n.endsWith('.json')).sort()) {
  const L = JSON.parse(fs.readFileSync(path.join(LEVELS, f), 'utf8'));
  const E = L.pieces.map(extents);
  const bad = [];
  L.pieces.forEach((spec, i) => {
    const e = E[i];
    if (e.bottom <= 0.01) return; // on the ground
    // Overlap of this piece's footprint with the tops of pieces directly below it.
    let covered = 0;
    for (let j = 0; j < E.length; j++) {
      if (i === j) continue;
      const o = E[j];
      if (Math.abs(o.top - e.bottom) > 0.06) continue; // not directly beneath
      covered += Math.max(0, Math.min(e.x1, o.x1) - Math.max(e.x0, o.x0));
    }
    const width = e.x1 - e.x0;
    const frac = covered / width;
    // A beam resting on two columns is only 25% covered and is perfectly fine: that is a
    // span, and it is what the reference clip shows. What is broken is a piece with
    // nothing under it, or one supported only on one side of its centre, which topples.
    let leftOfCentre = false;
    let rightOfCentre = false;
    for (let j = 0; j < E.length; j++) {
      if (i === j) continue;
      const o = E[j];
      if (Math.abs(o.top - e.bottom) > 0.06) continue;
      const lo = Math.max(e.x0, o.x0);
      const hi = Math.min(e.x1, o.x1);
      if (hi - lo <= 0.02) continue;
      if (lo < spec.x - 0.02) leftOfCentre = true;
      if (hi > spec.x + 0.02) rightOfCentre = true;
    }
    const spanned = leftOfCentre && rightOfCentre;
    if (frac < 0.02) bad.push(`FLOATING  ${spec.piece} at x=${spec.x} y=${spec.y}`);
    else if (!spanned && frac < 0.5) bad.push(`TEETERING ${spec.piece} at x=${spec.x} y=${spec.y} (${(frac*100).toFixed(0)}% on one side)`);
  });
  if (bad.length) {
    totalBad += bad.length;
    console.log(`${f}  ${L.name}`);
    bad.forEach(b => console.log('    ' + b));
  }
}
if (totalBad === 0) {
  console.log('All levels supported: nothing floating, nothing teetering.');
  process.exit(0);
}
console.log('\ntotal badly placed pieces:', totalBad);
process.exit(1);
