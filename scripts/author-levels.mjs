/**
 * author-levels.mjs
 *
 * OWNS: the thirty hand designed level layouts, and emitting them as the JSON files
 * under levels/ that the game actually reads.
 *
 * MUST NOT OWN: the level schema (src/game/level.js is the authority) or any physics.
 *
 * Why a script rather than thirty files typed out. Each level below is designed by hand:
 * its shape, its piece choices, its material overrides and its par are chosen for that
 * level and for where it sits in the difficulty curve. The helpers underneath are
 * carpentry, not generation. They place a row at a height or a pair of legs at a span,
 * so a design can be written as the shape it is rather than as sixty sets of
 * coordinates, and so a piece height changing in the manifest does not silently leave
 * every level floating.
 *
 * The JSON files this writes are committed and are the game's data. Rerun after editing
 * a design:  node scripts/author-levels.mjs
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

/** One piece. `f` is a material family override, `s` marks it a support. */
const at = (piece, x, y, extra = {}) => ({ piece, x, y, ...extra });

/**
 * A horizontal run of one piece type, laid side by side from `x0` at height `y`.
 * Returns the pieces and the x the run ended at, so runs can be chained.
 */
function run(piece, x0, y, count, extra = {}) {
  const w = DIM[piece].width;
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(at(piece, x0 + w / 2 + i * w, y, extra));
  return out;
}

/** A run centred on x = 0. */
function centredRun(piece, y, count, extra = {}) {
  const w = DIM[piece].width;
  return run(piece, -(count * w) / 2, y, count, extra);
}

/**
 * A pair of legs at +/- span, each of `piece`, marked as supports, with whatever sits on
 * top of them starting at the leg's height. Returns the pieces and the deck height.
 */
function legs(piece, span, y = 0, extra = {}) {
  return {
    pieces: [
      at(piece, -span, y, { support: true, ...extra }),
      at(piece, span, y, { support: true, ...extra }),
    ],
    deck: y + DIM[piece].height,
  };
}

/** A vertical stack of one piece type from `y`, `count` high. */
function stack(piece, x, y, count, extra = {}) {
  const h = DIM[piece].height;
  return Array.from({ length: count }, (_, i) => at(piece, x, y + i * h, extra));
}

// ---------------------------------------------------------------------------
// The thirty designs
// ---------------------------------------------------------------------------

/**
 * Each entry is one level, in order. `build()` returns the piece list.
 *
 * The curve: levels 1 to 6 teach one idea each on small, forgiving structures. 7 to 14
 * introduce tougher families and the support mechanic properly. 15 to 22 mix families so
 * a player has to choose a target. 23 to 30 are large and load bearing, where hitting the
 * wrong thing wastes a ball.
 */
const DESIGNS = [
  {
    name: 'First Light',
    par: 3,
    note: 'One crate on two short columns. Teaches that knocking a support drops the load.',
    build() {
      const l = legs('S02_SHORT_COLUMN', 1.2);
      return [...l.pieces, ...centredRun('B02_MEDIUM_BLOCK', l.deck, 1)];
    },
  },
  {
    name: 'Two Up',
    par: 4,
    build() {
      const l = legs('S02_SHORT_COLUMN', 1.6);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 1, 2),
      ];
    },
  },
  {
    name: 'Sandbar',
    par: 4,
    build() {
      const l = legs('S03_WIDE_FOOTING', 2.2);
      return [
        ...l.pieces,
        ...centredRun('B01_SMALL_BLOCK', l.deck, 4),
        ...centredRun('B02_MEDIUM_BLOCK', l.deck + 1, 2),
      ];
    },
  },
  {
    name: 'The Lookout',
    par: 5,
    note: 'A tall thin tower. Teaches that a hit at the base is worth more than one at the top.',
    build() {
      const l = legs('S03_WIDE_FOOTING', 1.4);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        ...stack('B01_SMALL_BLOCK', -0.5, l.deck + 1, 3),
        ...stack('B01_SMALL_BLOCK', 0.5, l.deck + 1, 3),
      ];
    },
  },
  {
    name: 'Gatehouse',
    par: 5,
    build() {
      return [
        ...legs('S02_SHORT_COLUMN', 2.2).pieces,
        ...centredRun('S05_ARCH', 2, 1),
        ...centredRun('B01_SMALL_BLOCK', 4, 3),
      ];
    },
  },
  {
    name: 'Driftwood',
    par: 5,
    build() {
      const l = legs('S02_SHORT_COLUMN', 2.6);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        ...centredRun('B02_MEDIUM_BLOCK', l.deck + 1, 2),
        ...centredRun('B05_LARGE_BLOCK', l.deck + 2, 1),
      ];
    },
  },
  {
    name: 'Kiln',
    par: 6,
    note: 'First brick. A player who has only met wood learns that some things take two hits.',
    build() {
      const l = legs('S03_WIDE_FOOTING', 2.4);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        ...centredRun('B04_TALL_BLOCK', l.deck + 1, 3),
      ];
    },
  },
  {
    name: 'Low Wall',
    par: 6,
    build() {
      return [
        ...centredRun('B02_MEDIUM_BLOCK', 0, 4),
        ...centredRun('B02_MEDIUM_BLOCK', 1, 4),
        ...centredRun('B01_SMALL_BLOCK', 2, 6),
      ];
    },
  },
  {
    name: 'Stilts',
    par: 6,
    build() {
      const l = legs('S01_ROUND_COLUMN', 2.4);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 1, 4),
        ...centredRun('B02_MEDIUM_BLOCK', l.deck + 2, 2),
      ];
    },
  },
  {
    name: 'The Bench',
    par: 6,
    build() {
      const l = legs('S02_SHORT_COLUMN', 3);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        ...centredRun('A01_T_BLOCK', l.deck + 1, 1),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 3, 2),
      ];
    },
  },
  {
    name: 'Quarry Steps',
    par: 7,
    build() {
      return [
        ...run('B05_LARGE_BLOCK', -4, 0, 1),
        ...run('B05_LARGE_BLOCK', -2, 0, 1),
        ...run('B05_LARGE_BLOCK', 0, 0, 1),
        ...run('B02_MEDIUM_BLOCK', -3, 2, 1),
        ...run('B02_MEDIUM_BLOCK', -1, 2, 1),
        ...run('B01_SMALL_BLOCK', -2, 3, 2),
      ];
    },
  },
  {
    name: 'The Roller',
    par: 6,
    note: 'Introduces A04. A ball off rubber goes somewhere else, which is the lesson.',
    build() {
      const l = legs('S03_WIDE_FOOTING', 2.4);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        at('A04_ROLLER', 0, l.deck + 1.5),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 2, 3),
      ];
    },
  },
  {
    name: 'Cold Store',
    par: 7,
    build() {
      const l = legs('S02_SHORT_COLUMN', 3);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        ...centredRun('B05_LARGE_BLOCK', l.deck + 1, 2),
        ...centredRun('B02_MEDIUM_BLOCK', l.deck + 3, 2),
      ];
    },
  },
  {
    name: 'Crosswise',
    par: 7,
    build() {
      const l = legs('S01_ROUND_COLUMN', 2.6);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 1),
        at('A03_CROSS_BEAM', 0, l.deck + 2.5),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 4, 2),
      ];
    },
  },
  {
    name: 'The Yard',
    par: 8,
    build() {
      return [
        ...centredRun('B02_MEDIUM_BLOCK', 0, 5),
        ...centredRun('B04_TALL_BLOCK', 1, 4),
        ...centredRun('B03_LONG_BEAM', 4, 2),
        ...centredRun('B01_SMALL_BLOCK', 5, 4),
      ];
    },
  },
  {
    name: 'Breakwater',
    par: 8,
    build() {
      return [
        ...centredRun('S04_WEDGE', 0, 4),
        ...centredRun('B02_MEDIUM_BLOCK', 1, 4),
        ...centredRun('B05_LARGE_BLOCK', 2, 2),
        ...centredRun('B01_SMALL_BLOCK', 4, 4),
      ];
    },
  },
  {
    name: 'Twin Arches',
    par: 8,
    build() {
      return [
        ...legs('S02_SHORT_COLUMN', 4).pieces,
        at('S05_ARCH', -2.4, 2),
        at('S05_ARCH', 2.4, 2),
        ...centredRun('B03_LONG_BEAM', 4, 2),
        ...centredRun('B02_MEDIUM_BLOCK', 5, 3),
      ];
    },
  },
  {
    name: 'The Frame',
    par: 8,
    build() {
      const l = legs('S01_ROUND_COLUMN', 3.2);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        at('A02_L_BLOCK', -1.6, l.deck + 1),
        at('A02_L_BLOCK', 1.6, l.deck + 1, { rotY: Math.PI }),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 3, 3),
      ];
    },
  },
  {
    name: 'Ballast',
    par: 9,
    note: 'Stone at the base, wood above. Rewards working from the bottom up.',
    build() {
      return [
        ...centredRun('S03_WIDE_FOOTING', 0, 3),
        ...centredRun('B05_LARGE_BLOCK', 0.5, 4),
        ...centredRun('B02_MEDIUM_BLOCK', 2.5, 4),
        ...centredRun('B01_SMALL_BLOCK', 3.5, 6),
      ];
    },
  },
  {
    name: 'Sea Wall',
    par: 9,
    build() {
      return [
        ...centredRun('B04_TALL_BLOCK', 0, 6),
        ...centredRun('B03_LONG_BEAM', 3, 2),
        ...centredRun('B02_MEDIUM_BLOCK', 4, 4),
        ...centredRun('B01_SMALL_BLOCK', 5, 4),
      ];
    },
  },
  {
    name: 'The Stabiliser',
    par: 9,
    build() {
      const l = legs('S03_WIDE_FOOTING', 3);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        at('A05_MECHANICAL_STABILIZER', 0, l.deck + 1),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 3, 4),
      ];
    },
  },
  {
    name: 'Pier',
    par: 9,
    build() {
      return [
        at('S01_ROUND_COLUMN', -3.5, 0, { support: true }),
        at('S01_ROUND_COLUMN', 0, 0, { support: true }),
        at('S01_ROUND_COLUMN', 3.5, 0, { support: true }),
        ...run('B03_LONG_BEAM', -4, 3, 2),
        ...run('B02_MEDIUM_BLOCK', -4, 4, 4),
        ...run('B01_SMALL_BLOCK', -3, 5, 6),
      ];
    },
  },
  {
    name: 'Foundry',
    par: 10,
    build() {
      const l = legs('S01_ROUND_COLUMN', 3.4);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        at('A03_CROSS_BEAM', -2, l.deck + 2.5),
        at('A03_CROSS_BEAM', 2, l.deck + 2.5),
        ...centredRun('B05_LARGE_BLOCK', l.deck + 4, 2),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 6, 3),
      ];
    },
  },
  {
    name: 'The Keep',
    par: 10,
    build() {
      return [
        ...centredRun('S03_WIDE_FOOTING', 0, 3),
        ...centredRun('B04_TALL_BLOCK', 0.5, 5),
        ...centredRun('B03_LONG_BEAM', 3.5, 2),
        ...centredRun('B05_LARGE_BLOCK', 4.5, 3),
        ...centredRun('S05_ARCH', 6.5, 2),
      ];
    },
  },
  {
    name: 'Hardstanding',
    par: 10,
    build() {
      return [
        ...centredRun('B05_LARGE_BLOCK', 0, 4, { family: 'concrete' }),
        ...centredRun('B02_MEDIUM_BLOCK', 2, 4, { family: 'stone' }),
        ...centredRun('B02_MEDIUM_BLOCK', 3, 4),
        ...centredRun('B01_SMALL_BLOCK', 4, 6),
      ];
    },
  },
  {
    name: 'Cantilever',
    par: 10,
    note: 'Load hanging past its support. Hitting the overhang is cheaper than the column.',
    build() {
      return [
        at('S01_ROUND_COLUMN', -1.5, 0, { support: true }),
        at('S01_ROUND_COLUMN', 1.5, 0, { support: true }),
        ...run('B03_LONG_BEAM', -5, 3, 1),
        ...run('B03_LONG_BEAM', -1, 3, 1),
        ...run('B03_LONG_BEAM', 3, 3, 1),
        ...run('B01_SMALL_BLOCK', -5, 4, 10),
        ...centredRun('B02_MEDIUM_BLOCK', 5, 4),
      ];
    },
  },
  {
    name: 'The Long Span',
    par: 11,
    build() {
      return [
        at('S02_SHORT_COLUMN', -4.5, 0, { support: true }),
        at('S02_SHORT_COLUMN', 0, 0, { support: true }),
        at('S02_SHORT_COLUMN', 4.5, 0, { support: true }),
        ...run('B03_LONG_BEAM', -5, 2, 1),
        ...run('B03_LONG_BEAM', -1, 2, 1),
        ...run('B03_LONG_BEAM', 3, 2, 1),
        ...run('B04_TALL_BLOCK', -4, 3, 3),
        ...run('B04_TALL_BLOCK', 2, 3, 3),
        ...centredRun('B03_LONG_BEAM', 6, 2),
        ...centredRun('B01_SMALL_BLOCK', 7, 4),
      ];
    },
  },
  {
    name: 'Ironworks',
    par: 11,
    build() {
      const l = legs('S01_ROUND_COLUMN', 4);
      return [
        ...l.pieces,
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        at('A01_T_BLOCK', -2.5, l.deck + 1),
        at('A01_T_BLOCK', 2.5, l.deck + 1),
        at('A05_MECHANICAL_STABILIZER', 0, l.deck + 1),
        ...centredRun('B05_LARGE_BLOCK', l.deck + 3, 3),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 5, 4),
      ];
    },
  },
  {
    name: 'The Citadel',
    par: 12,
    build() {
      return [
        ...centredRun('S03_WIDE_FOOTING', 0, 4),
        ...centredRun('B05_LARGE_BLOCK', 0.5, 5),
        ...centredRun('B04_TALL_BLOCK', 2.5, 9),
        ...centredRun('B03_LONG_BEAM', 5.5, 2),
        ...centredRun('S05_ARCH', 6.5, 2),
        ...centredRun('B01_SMALL_BLOCK', 8.5, 4),
      ];
    },
  },
  {
    name: 'Last Stand',
    par: 12,
    note: 'Steel legs, a stone core and a wooden crown. Everything the kit does, at once.',
    build() {
      const l = legs('S01_ROUND_COLUMN', 4.4);
      return [
        ...l.pieces,
        at('S02_SHORT_COLUMN', 0, 0, { support: true }),
        ...centredRun('B03_LONG_BEAM', l.deck, 2),
        ...centredRun('B05_LARGE_BLOCK', l.deck + 1, 3, { family: 'stone' }),
        at('A03_CROSS_BEAM', -2.5, l.deck + 4.5),
        at('A03_CROSS_BEAM', 2.5, l.deck + 4.5),
        ...centredRun('B03_LONG_BEAM', l.deck + 6, 2),
        ...centredRun('B02_MEDIUM_BLOCK', l.deck + 7, 4),
        ...centredRun('B01_SMALL_BLOCK', l.deck + 8, 4),
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
// Remove any level file from a previous run, so a deleted design does not linger.
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT_DIR, f));
}

let maxPieces = 0;
DESIGNS.forEach((design, index) => {
  const id = index + 1;
  const pieces = design.build().map((p) => {
    // Round authored coordinates, so a value like 0.30000000000000004 never reaches a
    // level file and make a clean diff impossible.
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
  const file = path.join(OUT_DIR, `${String(id).padStart(2, '0')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(level, null, 2)}\n`);
  console.log(
    `${String(id).padStart(2)} ${design.name.padEnd(20)} par ${String(design.par).padStart(2)}  `
    + `${String(pieces.length).padStart(2)} pieces`,
  );
});

console.log(`\nWrote ${DESIGNS.length} levels to levels/. Largest is ${maxPieces} pieces.`);

function round(n) {
  return Math.round(n * 1000) / 1000;
}
