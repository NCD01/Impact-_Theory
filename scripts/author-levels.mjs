/**
 * author-levels.mjs
 *
 * OWNS: the thirty hand designed level layouts, and emitting them as the JSON files under
 * levels/ that the game actually reads.
 *
 * MUST NOT OWN: the level schema (src/game/level.js is the authority) or any physics.
 *
 * Why a script rather than thirty files typed out. Each level below is designed by hand:
 * its platform, its rows, its piece choices, its material overrides and its par. The
 * helpers underneath are carpentry, not generation. They lay a deck across pedestals or
 * fill a row with pieces, so a design can be written as the shape it is rather than as
 * sixty sets of coordinates, and so a piece height changing in the manifest does not
 * silently leave every level floating.
 *
 * THE PLATFORM, AND WHY EVERY LEVEL HAS ONE.
 *
 * The first version of this file used a `legs()` helper that placed two pedestals and
 * left whatever sat above them to line up by luck. It mostly did not. A support check
 * across the thirty levels found 26 pieces either floating in mid air or balanced on one
 * edge of a pedestal with nothing under the rest of them. The owner saw it immediately
 * and said the structures are "always on a platform that is missing".
 *
 * He was right, and the reference clip agrees: its structures stand on short decorative
 * pedestals with a continuous base above them, and nothing hangs in the air.
 *
 * So `platform()` now builds both halves together. It lays a deck of beams across a span
 * and puts a pedestal under **every joint in that deck, including both ends**, so the deck
 * is properly carried and everything above it has continuous ground to stand on. A beam
 * bridging two pedestals is still a span and still correct; what is gone is the piece with
 * nothing beneath it.
 *
 * `node scripts/verify-level-support.mjs` checks this and the unit suite runs it, so it
 * cannot regress.
 *
 * The JSON files this writes are committed and are the game's data. Rerun after editing:
 *   node scripts/author-levels.mjs
 *
 * Level names and copy are original to this project. Nothing here is taken from the
 * reference clip.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'levels');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(REPO_ROOT, 'Assets', 'Art', 'Blocks', 'block_asset_manifest.json'), 'utf8',
));

/** Piece dimensions, read from the manifest so no size is restated here. */
const DIM = Object.fromEntries(MANIFEST.pieces.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Carpentry helpers
// ---------------------------------------------------------------------------

/** One piece. `extra` carries `family`, `support`, `rotY` or `fixed`. */
const at = (piece, x, y, extra = {}) => ({ piece, x, y, ...extra });

/** The height a piece occupies above its own `y`, accounting for its pivot. */
function heightAbove(piece) {
  const d = DIM[piece];
  return d.pivot === 'geometric-center' ? d.height / 2 : d.height;
}

/**
 * A platform: a deck of beams carried by pedestals under every joint.
 *
 * `span` is rounded to a whole number of deck beams, so the deck is continuous with no
 * gap anywhere along it. Pedestals go under each joint and under both ends, inset so that
 * no pedestal overhangs the platform.
 *
 * Returns the pieces and `top`, the height everything above should start at.
 *
 * @param {{pedestal?: string, deck?: string, span?: number, y?: number}} opts
 */
function platform({
  pedestal = 'S02_SHORT_COLUMN', deck = 'B03_LONG_BEAM', span = 8, y = 0,
} = {}) {
  const pw = DIM[pedestal].width;
  const ph = heightAbove(pedestal);
  const bw = DIM[deck].width;
  const bh = heightAbove(deck);

  const count = Math.max(1, Math.round(span / bw));
  const width = count * bw;
  const x0 = -width / 2;

  const pieces = [];

  // Pedestals first, at every deck joint and at both ends, clamped inside the platform.
  for (let i = 0; i <= count; i += 1) {
    const raw = x0 + i * bw;
    const x = Math.min(x0 + width - pw / 2, Math.max(x0 + pw / 2, raw));
    pieces.push(at(pedestal, round(x), y, { support: true }));
  }
  // Then the deck, laid end to end across them.
  for (let i = 0; i < count; i += 1) {
    pieces.push(at(deck, round(x0 + bw / 2 + i * bw), round(y + ph)));
  }

  return { pieces, top: round(y + ph + bh), width };
}

/**
 * A row of one piece type, centred, `count` pieces wide.
 *
 * Throws if the row would be wider than `maxWidth`, because a row wider than the platform
 * under it is exactly the defect this file exists to avoid.
 */
function row(piece, y, count, maxWidth, extra = {}) {
  const w = DIM[piece].width;
  const total = count * w;
  if (maxWidth !== undefined && total > maxWidth + 1e-6) {
    throw new Error(
      `A row of ${count} x ${piece} is ${total} SU wide, wider than the ${maxWidth} SU `
      + 'beneath it. Reduce the count or widen the platform.',
    );
  }
  return Array.from({ length: count }, (_, i) => at(piece, round(-total / 2 + w / 2 + i * w), round(y), extra));
}

/** A vertical stack of one piece type. */
function stack(piece, x, y, count, extra = {}) {
  const h = heightAbove(piece);
  return Array.from({ length: count }, (_, i) => at(piece, round(x), round(y + i * h), extra));
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// The thirty designs
// ---------------------------------------------------------------------------

/**
 * Each entry is one level, in order.
 *
 * The curve: 1 to 6 teach one idea each on small platforms. 7 to 14 introduce tougher
 * families and taller stacks. 15 to 22 mix families so a player has to choose a target.
 * 23 to 30 are wide and heavy, where hitting the wrong thing wastes a ball.
 */
const DESIGNS = [
  {
    name: 'First Light',
    par: 3,
    note: 'One crate on a small platform. The whole game in one shot.',
    build() {
      const p = platform({ span: 4 });
      return [...p.pieces, ...row('B02_MEDIUM_BLOCK', p.top, 1, p.width)];
    },
  },
  {
    name: 'Two Up',
    par: 4,
    build() {
      const p = platform({ span: 4 });
      return [
        ...p.pieces,
        ...row('B01_SMALL_BLOCK', p.top, 3, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 1, 1, p.width),
      ];
    },
  },
  {
    name: 'Sandbar',
    par: 4,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B01_SMALL_BLOCK', p.top, 6, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 1, 2, p.width),
      ];
    },
  },
  {
    name: 'The Lookout',
    par: 5,
    note: 'A tall thin tower. A hit at the base is worth more than one at the top.',
    build() {
      const p = platform({ span: 4 });
      return [
        ...p.pieces,
        ...stack('B01_SMALL_BLOCK', -0.5, p.top, 4),
        ...stack('B01_SMALL_BLOCK', 0.5, p.top, 4),
      ];
    },
  },
  {
    name: 'Gatehouse',
    par: 5,
    build() {
      const p = platform({ span: 4 });
      return [
        ...p.pieces,
        ...row('S05_ARCH', p.top, 1, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 2, 3, p.width),
      ];
    },
  },
  {
    name: 'Driftwood',
    par: 5,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B02_MEDIUM_BLOCK', p.top, 4, p.width),
        ...row('B05_LARGE_BLOCK', p.top + 1, 2, p.width),
      ];
    },
  },
  {
    name: 'Kiln',
    par: 6,
    note: 'First brick. A player who has only met wood learns some things take two hits.',
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B04_TALL_BLOCK', p.top, 6, p.width),
      ];
    },
  },
  {
    name: 'Low Wall',
    par: 6,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B02_MEDIUM_BLOCK', p.top, 4, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 1, 4, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 2, 6, p.width),
      ];
    },
  },
  {
    name: 'Stilts',
    par: 6,
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 8 });
      return [
        ...p.pieces,
        ...row('B01_SMALL_BLOCK', p.top, 6, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 1, 2, p.width),
      ];
    },
  },
  {
    name: 'The Bench',
    par: 6,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('A01_T_BLOCK', p.top, 2, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 2, 4, p.width),
      ];
    },
  },
  {
    name: 'Quarry Steps',
    par: 7,
    build() {
      const p = platform({ pedestal: 'S03_WIDE_FOOTING', span: 8 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 4, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 2, 2, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 3, 2, p.width),
      ];
    },
  },
  {
    name: 'The Roller',
    par: 6,
    note: 'Introduces A04. A ball off rubber goes somewhere else, which is the lesson.',
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B02_MEDIUM_BLOCK', p.top, 4, p.width),
        // Three rollers laid edge to edge, so the row above rests on a continuous
        // surface. Two rollers left a 2 SU gap in the middle and the crates over it hung
        // in mid air, which is the exact defect this file's header is about.
        at('A04_ROLLER', -2, p.top + 1.5),
        at('A04_ROLLER', 0, p.top + 1.5),
        at('A04_ROLLER', 2, p.top + 1.5),
        ...row('B01_SMALL_BLOCK', p.top + 2, 6, p.width),
      ];
    },
  },
  {
    name: 'Cold Store',
    par: 7,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 4, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 2, 4, p.width),
      ];
    },
  },
  {
    name: 'Crosswise',
    par: 7,
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 8 });
      return [
        ...p.pieces,
        at('A03_CROSS_BEAM', -1.5, p.top + 1.5),
        at('A03_CROSS_BEAM', 1.5, p.top + 1.5),
        ...row('B01_SMALL_BLOCK', p.top + 3, 4, p.width),
      ];
    },
  },
  {
    name: 'The Yard',
    par: 8,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B02_MEDIUM_BLOCK', p.top, 4, p.width),
        ...row('B04_TALL_BLOCK', p.top + 1, 6, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 4, 6, p.width),
      ];
    },
  },
  {
    name: 'Breakwater',
    par: 8,
    build() {
      const p = platform({ pedestal: 'S03_WIDE_FOOTING', span: 8 });
      return [
        ...p.pieces,
        ...row('S04_WEDGE', p.top, 4, p.width),
        ...row('B05_LARGE_BLOCK', p.top + 1, 4, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 3, 6, p.width),
      ];
    },
  },
  {
    name: 'Twin Arches',
    par: 8,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        at('S05_ARCH', -1.5, p.top),
        at('S05_ARCH', 1.5, p.top),
        ...row('B02_MEDIUM_BLOCK', p.top + 2, 4, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 3, 4, p.width),
      ];
    },
  },
  {
    name: 'The Frame',
    par: 8,
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 8 });
      return [
        ...p.pieces,
        at('A02_L_BLOCK', -1, p.top),
        at('A02_L_BLOCK', 1, p.top, { rotY: Math.PI }),
        ...row('B03_LONG_BEAM', p.top + 2, 2, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 3, 4, p.width),
      ];
    },
  },
  {
    name: 'Ballast',
    par: 9,
    note: 'Stone at the base, wood above. Rewards working from the bottom up.',
    build() {
      const p = platform({ pedestal: 'S03_WIDE_FOOTING', span: 8 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 4, p.width, { family: 'stone' }),
        ...row('B02_MEDIUM_BLOCK', p.top + 2, 4, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 3, 6, p.width),
      ];
    },
  },
  {
    name: 'Sea Wall',
    par: 9,
    build() {
      const p = platform({ span: 8 });
      return [
        ...p.pieces,
        ...row('B04_TALL_BLOCK', p.top, 6, p.width),
        ...row('B03_LONG_BEAM', p.top + 3, 2, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 4, 6, p.width),
      ];
    },
  },
  {
    name: 'The Stabiliser',
    par: 9,
    build() {
      const p = platform({ pedestal: 'S03_WIDE_FOOTING', span: 8 });
      return [
        ...p.pieces,
        at('A05_MECHANICAL_STABILIZER', -1.5, p.top),
        at('A05_MECHANICAL_STABILIZER', 1.5, p.top),
        ...row('B03_LONG_BEAM', p.top + 2, 2, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 3, 6, p.width),
      ];
    },
  },
  {
    name: 'Pier',
    par: 9,
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 12 });
      return [
        ...p.pieces,
        ...row('B02_MEDIUM_BLOCK', p.top, 6, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 1, 8, p.width),
      ];
    },
  },
  {
    name: 'Foundry',
    par: 10,
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 8 });
      return [
        ...p.pieces,
        at('A03_CROSS_BEAM', -1.5, p.top + 1.5),
        at('A03_CROSS_BEAM', 1.5, p.top + 1.5),
        ...row('B05_LARGE_BLOCK', p.top + 3, 4, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 5, 6, p.width),
      ];
    },
  },
  {
    name: 'The Keep',
    par: 10,
    build() {
      const p = platform({ pedestal: 'S03_WIDE_FOOTING', span: 8 });
      return [
        ...p.pieces,
        ...row('B04_TALL_BLOCK', p.top, 6, p.width),
        ...row('B05_LARGE_BLOCK', p.top + 3, 4, p.width),
        ...row('S05_ARCH', p.top + 5, 2, p.width),
      ];
    },
  },
  {
    name: 'Hardstanding',
    par: 10,
    build() {
      const p = platform({ span: 12 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 6, p.width, { family: 'concrete' }),
        ...row('B02_MEDIUM_BLOCK', p.top + 2, 6, p.width, { family: 'stone' }),
        ...row('B01_SMALL_BLOCK', p.top + 3, 8, p.width),
      ];
    },
  },
  {
    name: 'Cantilever',
    par: 10,
    note: 'A heavy deck on tall columns. The columns are the real target.',
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 12 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 6, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 2, 10, p.width),
      ];
    },
  },
  {
    name: 'The Long Span',
    par: 11,
    build() {
      const p = platform({ span: 12 });
      return [
        ...p.pieces,
        ...row('B04_TALL_BLOCK', p.top, 10, p.width),
        ...row('B03_LONG_BEAM', p.top + 3, 3, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 4, 8, p.width),
      ];
    },
  },
  {
    name: 'Ironworks',
    par: 11,
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 12 });
      return [
        ...p.pieces,
        ...row('A01_T_BLOCK', p.top, 4, p.width),
        ...row('B05_LARGE_BLOCK', p.top + 2, 6, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 4, 8, p.width),
      ];
    },
  },
  {
    name: 'The Citadel',
    par: 12,
    build() {
      const p = platform({ pedestal: 'S03_WIDE_FOOTING', span: 12 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 6, p.width),
        ...row('B04_TALL_BLOCK', p.top + 2, 10, p.width),
        ...row('B03_LONG_BEAM', p.top + 5, 3, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 6, 8, p.width),
      ];
    },
  },
  {
    name: 'Last Stand',
    par: 12,
    note: 'Steel legs, a stone core and a wooden crown. Everything the kit does, at once.',
    build() {
      const p = platform({ pedestal: 'S01_ROUND_COLUMN', span: 12 });
      return [
        ...p.pieces,
        ...row('B05_LARGE_BLOCK', p.top, 6, p.width, { family: 'stone' }),
        ...row('B04_TALL_BLOCK', p.top + 2, 10, p.width),
        ...row('B02_MEDIUM_BLOCK', p.top + 5, 6, p.width),
        ...row('B01_SMALL_BLOCK', p.top + 6, 8, p.width),
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

if (DESIGNS.length !== 30) {
  console.error(`Expected 30 designs, found ${DESIGNS.length}.`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT_DIR, f));
}

let maxPieces = 0;
DESIGNS.forEach((design, index) => {
  const id = index + 1;
  const pieces = design.build().map((p) => {
    const out = { piece: p.piece, x: round(p.x), y: round(p.y) };
    if (p.z !== undefined) out.z = round(p.z);
    if (p.rotY !== undefined) out.rotY = round(p.rotY);
    if (p.family !== undefined) out.family = p.family;
    if (p.support !== undefined) out.support = p.support;
    if (p.fixed !== undefined) out.fixed = p.fixed;
    return out;
  });
  maxPieces = Math.max(maxPieces, pieces.length);

  const level = {
    schema: 1,
    id,
    name: design.name,
    par: design.par,
    ...(design.note ? { note: design.note } : {}),
    pieces,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, `${String(id).padStart(2, '0')}.json`),
    `${JSON.stringify(level, null, 2)}\n`,
  );
  console.log(
    `${String(id).padStart(2)} ${design.name.padEnd(20)} par ${String(design.par).padStart(2)}  `
    + `${String(pieces.length).padStart(2)} pieces`,
  );
});

console.log(`\nWrote ${DESIGNS.length} levels to levels/. Largest is ${maxPieces} pieces.`);
console.log('Now run: node scripts/verify-level-support.mjs');
