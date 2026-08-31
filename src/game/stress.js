/**
 * stress.js
 *
 * OWNS: generating a structure of an arbitrary piece count, used by the body budget
 * spike to find how many dynamic rigid bodies hold a playable frame rate.
 *
 * MUST NOT OWN: anything the game uses during normal play. This module exists so the
 * spike measures the real converted kit, the real colliders and the real materials
 * rather than placeholder cubes, which is the difference between a budget for this game
 * and a budget for a game nobody is building.
 *
 * A note on why the layout is fussy. The first version of this file stacked a mixed bag
 * of pieces on rows a fixed 1.05 SU apart. Several of those pieces are 2 and 3 SU tall,
 * so they interpenetrated the rows above them, the solver pushed them apart hard on the
 * first frame, and the resulting impacts destroyed the whole wall before the spike could
 * measure anything. The measurement that came back was a flat 60 fps at every piece
 * count, because by the time it sampled, the scene was empty.
 *
 * So: only pieces one Structural Unit tall are used, rows are exactly one unit apart,
 * and each row is filled by walking along X and advancing by each piece's own width. The
 * wall starts stable and legal, and collapses only when it is hit.
 */

/**
 * Pieces used to build the wall. Every one is exactly 1 SU tall with a center-bottom
 * pivot, which is what makes uniform rows correct. The mix deliberately includes
 * S04_WEDGE because it is a compound collider, so the budget covers the cost of the
 * multi shape pieces a real level uses and not only of boxes.
 *
 * Widths are from block_asset_manifest.json.
 */
const ROW_MIX = [
  { id: 'B01_SMALL_BLOCK', width: 1 },
  { id: 'B02_MEDIUM_BLOCK', width: 2 },
  { id: 'S04_WEDGE', width: 2 },
  { id: 'B01_SMALL_BLOCK', width: 1 },
  { id: 'B03_LONG_BEAM', width: 4 },
];

/**
 * Half width of the wall in SU, as a function of piece count.
 *
 * A wall of fixed width grows only upward, and a hundred pieces four to a row is a
 * twenty five unit tower that falls over under its own weight before it can be
 * measured. Widening with the count keeps the wall in roughly the proportions a real
 * level has, so the budget is measured on a shape the game will actually build.
 * Clamped at 9 SU because past that the wall leaves the camera frustum and stops being
 * a fair test of the rendered scene.
 *
 * @param {number} count
 * @returns {number}
 */
function wallHalfWidth(count) {
  return Math.min(9, Math.max(3, 3 + count / 26));
}

/** Vertical spacing between rows, SU. Equal to the piece height, so rows sit flush. */
const ROW_HEIGHT = 1;

/**
 * Builds a wall of roughly `count` pieces standing on two wide footings.
 *
 * Assumes every id in ROW_MIX is in the manifest and is 1 SU tall. Returns level piece
 * specs in the same shape src/game/structure.js `place()` takes, so the spike exercises
 * the identical code path a real level does.
 *
 * The returned count is approximate: rows are filled to the wall width, so the total
 * lands on a row boundary at or just above `count`.
 *
 * @param {number} count Target number of non support pieces.
 * @returns {Array<object>}
 */
export function buildStressStack(count) {
  const specs = [
    { piece: 'S03_WIDE_FOOTING', x: -2.5, y: 0, support: true },
    { piece: 'S03_WIDE_FOOTING', x: 2.5, y: 0, support: true },
  ];

  // The footings are 0.5 SU tall, so the wall starts on top of them.
  const baseY = 0.5;
  const halfWidth = wallHalfWidth(count);
  let placed = 0;
  let row = 0;
  let mixCursor = 0;

  while (placed < count) {
    let x = -halfWidth;
    // Fill one row left to right, advancing by each piece's own width so nothing
    // overlaps its neighbour.
    while (x < halfWidth && placed < count) {
      const entry = ROW_MIX[mixCursor % ROW_MIX.length];
      mixCursor += 1;
      if (x + entry.width > halfWidth) {
        // This piece will not fit in what is left of the row. Try the next one, which
        // is narrower often enough that rows pack well, and stop if nothing fits.
        if (entry.width === 1) break;
        continue;
      }
      specs.push({
        piece: entry.id,
        x: x + entry.width / 2,
        y: baseY + row * ROW_HEIGHT,
      });
      x += entry.width;
      placed += 1;
    }
    row += 1;
    // A wall taller than this leaves the camera frustum, and pieces the camera cannot
    // see still cost physics but stop being a fair test of the rendered scene.
    if (row > 40) break;
  }

  return specs;
}
