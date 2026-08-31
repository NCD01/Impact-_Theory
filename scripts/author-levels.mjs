/**
 * author-levels.mjs
 *
 * OWNS: the thirty hand designed level layouts, and emitting them as the JSON files under
 * levels/ that the game actually reads.
 *
 * MUST NOT OWN: the level schema (src/game/level.js is the authority) or any physics.
 *
 * Why a script rather than thirty files typed out. Each level below is designed by hand:
 * its base, its rows, its piece choices, its material overrides and its par. The helpers
 * underneath are carpentry, not generation, so a design reads as the shape it is and a
 * piece height changing in the manifest does not silently leave every level floating.
 *
 * THE PEDESTALS, AND WHY THEY ARE NOT PIECES.
 *
 * Two earlier versions of this file got the base wrong and the owner caught both.
 *
 * The first used a `legs()` helper that dropped two kit columns and left whatever sat on
 * them to line up by luck. A support check found 26 pieces floating or balanced on one
 * pedestal edge.
 *
 * The second built a continuous deck, which fixed the floating, but the plinths were still
 * kit pieces and therefore dynamic: they fell over with everything else. The owner pointed
 * at the reference and said the platform "does not move", and frame 9 proves it. The whole
 * structure has collapsed into rubble on the sand and both plinths are still standing
 * perfectly upright. They are scenery, not part of the puzzle.
 *
 * So pedestals are no longer pieces at all. A level declares them as x positions and the
 * game places them as fixed, decorative plinths (src/game/pedestal.js). They never fall,
 * they are never scored, and they are not part of the clear condition.
 *
 * `node scripts/verify-level-support.mjs` checks that nothing above them floats, and the
 * unit suite runs the same check, so neither defect can come back.
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

/**
 * Total height of a pedestal, SU. Must match PEDESTAL_HEIGHT in src/game/pedestal.js.
 * Restated rather than imported because this script runs in plain Node and importing the
 * game module would pull in three.js for no reason. A unit test asserts they agree.
 */
const PEDESTAL_HEIGHT = 1.6;

// ---------------------------------------------------------------------------
// Carpentry helpers
// ---------------------------------------------------------------------------

/** One piece. `extra` carries `family`, `rotY` or `fixed`. */
const at = (piece, x, y, extra = {}) => ({ piece, x, y, ...extra });

/** The height a piece occupies above its own `y`, accounting for its pivot. */
function heightAbove(piece) {
  const d = DIM[piece];
  return d.pivot === 'geometric-center' ? d.height / 2 : d.height;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * A row of one piece type, centred, `count` pieces wide.
 *
 * Throws if the row is wider than `maxWidth`, because a row wider than whatever carries it
 * is exactly the defect this file exists to avoid.
 */
function row(piece, y, count, maxWidth, extra = {}) {
  const w = DIM[piece].width;
  const total = count * w;
  if (maxWidth !== undefined && total > maxWidth + 1e-6) {
    throw new Error(
      `A row of ${count} x ${piece} is ${total} SU wide, wider than the ${maxWidth} SU `
      + 'beneath it. Reduce the count or use a wider base.',
    );
  }
  return Array.from(
    { length: count },
    (_, i) => at(piece, round(-total / 2 + w / 2 + i * w), round(y), extra),
  );
}

/** A vertical stack of one piece type. */
function stack(piece, x, y, count, extra = {}) {
  const h = heightAbove(piece);
  return Array.from({ length: count }, (_, i) => at(piece, round(x), round(y + i * h), extra));
}

/**
 * A pedestal arrangement, plus the deck that sits on it.
 *
 * Three arrangements, and they are the only three, because each has pedestals under both
 * sides of every deck beam's centre. That is what stops a beam teetering on a single
 * plinth, which is the defect that shipped in the first two attempts at these levels.
 *
 *   single  one plinth and nothing else. Narrow and precarious, which is what the
 *           reference clip's opening frame shows.
 *   pair    two plinths 3 SU apart carrying one 4 SU beam. Usable width 4.
 *   triple  three plinths 6 SU apart carrying two beams. Usable width 8.
 *
 * @param {'single'|'pair'|'triple'} kind
 */
function base(kind) {
  if (kind === 'single') {
    // The cap is 1.1 SU across, so only a one unit wide piece belongs directly on it.
    return { xs: [0], deck: [], top: PEDESTAL_HEIGHT, width: 1 };
  }
  if (kind === 'pair') {
    return {
      xs: [-1.5, 1.5],
      deck: row('B03_LONG_BEAM', PEDESTAL_HEIGHT, 1, 4),
      top: PEDESTAL_HEIGHT + 1,
      width: 4,
    };
  }
  return {
    xs: [-3, 0, 3],
    deck: row('B03_LONG_BEAM', PEDESTAL_HEIGHT, 2, 8),
    top: PEDESTAL_HEIGHT + 1,
    width: 8,
  };
}

/** Shorthand for a design: pedestals, plus the deck, plus everything stacked on it. */
const on = (b, ...rows) => ({ pedestals: b.xs, pieces: [...b.deck, ...rows.flat()] });

// ---------------------------------------------------------------------------
// The thirty designs
// ---------------------------------------------------------------------------

/**
 * Each entry is one level, in order.
 *
 * The curve: 1 to 3 are single plinth towers that teach aiming. 4 to 10 add a deck and a
 * second plinth. 11 onward use the wide base, tougher families and taller stacks.
 */
const DESIGNS = [
  {
    name: 'First Light',
    par: 3,
    note: 'Two big crates on a wide deck. The largest target in the game, on purpose.',
    build() {
      // A deliberately large, easy target. The first version of this level was a single
      // 1 SU crate on one plinth, which took 36 shots to hit in testing because it is a
      // tiny target at the far end of the playfield. A first level should be won by
      // pointing roughly at it.
      const b = base('pair');
      return on(b, row('B05_LARGE_BLOCK', b.top, 2, b.width));
    },
  },
  {
    name: 'Two Up',
    par: 3,
    build() {
      const b = base('pair');
      return on(
        b,
        row('B02_MEDIUM_BLOCK', b.top, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 1, 4, b.width),
      );
    },
  },
  {
    name: 'The Lookout',
    par: 4,
    note: 'A tall thin tower on one plinth. Tall is easy to hit; low down is where it counts.',
    build() {
      // The single plinth arrives here rather than at level 1, and it carries a 6 SU tall
      // stack, which is a generous target vertically even though it is only 1 SU wide.
      const b = base('single');
      return on(b, stack('B04_TALL_BLOCK', 0, b.top, 2));
    },
  },
  {
    name: 'Sandbar',
    par: 4,
    build() {
      const b = base('pair');
      return on(b, row('B01_SMALL_BLOCK', b.top, 4, b.width));
    },
  },
  {
    name: 'Gatehouse',
    par: 5,
    build() {
      const b = base('pair');
      return on(
        b,
        row('B01_SMALL_BLOCK', b.top, 4, b.width),
        row('B05_LARGE_BLOCK', b.top + 1, 2, b.width),
      );
    },
  },
  {
    name: 'Driftwood',
    par: 5,
    build() {
      const b = base('pair');
      return on(
        b,
        row('B01_SMALL_BLOCK', b.top, 4, b.width),
        row('B02_MEDIUM_BLOCK', b.top + 1, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 2, 2, b.width),
      );
    },
  },
  {
    name: 'Kiln',
    par: 6,
    note: 'First brick. A player who has only met wood learns some things take two hits.',
    build() {
      const b = base('pair');
      return on(b, row('B04_TALL_BLOCK', b.top, 4, b.width));
    },
  },
  {
    name: 'The Arch',
    par: 5,
    build() {
      const b = base('pair');
      return on(
        b,
        row('S05_ARCH', b.top, 1, b.width),
        row('B01_SMALL_BLOCK', b.top + 2, 3, b.width),
      );
    },
  },
  {
    name: 'Stilts',
    par: 6,
    build() {
      const b = base('pair');
      return on(
        b,
        row('B05_LARGE_BLOCK', b.top, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 2, 4, b.width),
      );
    },
  },
  {
    name: 'The Bench',
    par: 6,
    build() {
      const b = base('pair');
      return on(
        b,
        row('A01_T_BLOCK', b.top, 1, b.width),
        row('B01_SMALL_BLOCK', b.top + 2, 3, b.width),
      );
    },
  },
  {
    name: 'Low Wall',
    par: 6,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B02_MEDIUM_BLOCK', b.top, 4, b.width),
        row('B01_SMALL_BLOCK', b.top + 1, 8, b.width),
      );
    },
  },
  {
    name: 'The Roller',
    par: 6,
    note: 'Introduces A04. A ball off rubber goes somewhere else, which is the lesson.',
    build() {
      const b = base('triple');
      return on(
        b,
        [
          at('A04_ROLLER', -3, b.top + 0.5),
          at('A04_ROLLER', -1, b.top + 0.5),
          at('A04_ROLLER', 1, b.top + 0.5),
          at('A04_ROLLER', 3, b.top + 0.5),
        ],
        row('B01_SMALL_BLOCK', b.top + 1, 6, b.width),
      );
    },
  },
  {
    name: 'Quarry Steps',
    par: 7,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B05_LARGE_BLOCK', b.top, 4, b.width),
        row('B02_MEDIUM_BLOCK', b.top + 2, 3, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 4, b.width),
      );
    },
  },
  {
    name: 'Cold Store',
    par: 7,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B04_TALL_BLOCK', b.top, 6, b.width),
        row('B03_LONG_BEAM', b.top + 3, 1, b.width),
      );
    },
  },
  {
    name: 'Crosswise',
    par: 7,
    build() {
      const b = base('triple');
      return on(
        b,
        [at('A03_CROSS_BEAM', -1.5, b.top + 1.5), at('A03_CROSS_BEAM', 1.5, b.top + 1.5)],
        row('B01_SMALL_BLOCK', b.top + 3, 6, b.width),
      );
    },
  },
  {
    name: 'The Yard',
    par: 8,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B02_MEDIUM_BLOCK', b.top, 4, b.width),
        row('B04_TALL_BLOCK', b.top + 1, 6, b.width),
        row('B01_SMALL_BLOCK', b.top + 4, 6, b.width),
      );
    },
  },
  {
    name: 'Breakwater',
    par: 8,
    build() {
      const b = base('triple');
      return on(
        b,
        row('S04_WEDGE', b.top, 4, b.width),
        row('B05_LARGE_BLOCK', b.top + 1, 4, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 6, b.width),
      );
    },
  },
  {
    name: 'Twin Arches',
    par: 8,
    build() {
      const b = base('triple');
      return on(
        b,
        [at('S05_ARCH', -1.5, b.top), at('S05_ARCH', 1.5, b.top)],
        row('B02_MEDIUM_BLOCK', b.top + 2, 3, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 4, b.width),
      );
    },
  },
  {
    name: 'The Frame',
    par: 8,
    build() {
      const b = base('triple');
      return on(
        b,
        [at('A02_L_BLOCK', -1, b.top), at('A02_L_BLOCK', 1, b.top, { rotY: Math.PI })],
        row('B03_LONG_BEAM', b.top + 2, 1, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 4, b.width),
      );
    },
  },
  {
    name: 'Ballast',
    par: 9,
    note: 'Stone at the base, wood above. Rewards working from the bottom up.',
    build() {
      const b = base('triple');
      return on(
        b,
        row('B05_LARGE_BLOCK', b.top, 4, b.width, { family: 'stone' }),
        row('B02_MEDIUM_BLOCK', b.top + 2, 4, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 6, b.width),
      );
    },
  },
  {
    name: 'Sea Wall',
    par: 9,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B04_TALL_BLOCK', b.top, 8, b.width),
        row('B03_LONG_BEAM', b.top + 3, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 4, 6, b.width),
      );
    },
  },
  {
    name: 'The Stabiliser',
    par: 9,
    build() {
      const b = base('triple');
      return on(
        b,
        [
          at('A05_MECHANICAL_STABILIZER', -1.5, b.top),
          at('A05_MECHANICAL_STABILIZER', 1.5, b.top),
        ],
        row('B03_LONG_BEAM', b.top + 2, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 6, b.width),
      );
    },
  },
  {
    name: 'Pier',
    par: 9,
    build() {
      const b = base('triple');
      return on(
        b,
        row('S02_SHORT_COLUMN', b.top, 8, b.width),
        row('B03_LONG_BEAM', b.top + 2, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 3, 8, b.width),
      );
    },
  },
  {
    name: 'Foundry',
    par: 10,
    build() {
      const b = base('triple');
      return on(
        b,
        row('S01_ROUND_COLUMN', b.top, 6, b.width),
        row('B03_LONG_BEAM', b.top + 3, 2, b.width),
        row('B05_LARGE_BLOCK', b.top + 4, 4, b.width),
      );
    },
  },
  {
    name: 'The Keep',
    par: 10,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B05_LARGE_BLOCK', b.top, 4, b.width),
        row('B04_TALL_BLOCK', b.top + 2, 6, b.width),
        row('S05_ARCH', b.top + 5, 2, b.width),
      );
    },
  },
  {
    name: 'Hardstanding',
    par: 10,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B05_LARGE_BLOCK', b.top, 4, b.width, { family: 'concrete' }),
        row('B02_MEDIUM_BLOCK', b.top + 2, 4, b.width, { family: 'stone' }),
        row('B01_SMALL_BLOCK', b.top + 3, 8, b.width),
      );
    },
  },
  {
    name: 'Cantilever',
    par: 10,
    note: 'A heavy deck on tall columns. The columns are the real target.',
    build() {
      const b = base('triple');
      return on(
        b,
        row('S01_ROUND_COLUMN', b.top, 8, b.width),
        row('B03_LONG_BEAM', b.top + 3, 2, b.width),
        row('B01_SMALL_BLOCK', b.top + 4, 8, b.width),
      );
    },
  },
  {
    name: 'The Long Span',
    par: 11,
    build() {
      const b = base('triple');
      return on(
        b,
        row('B04_TALL_BLOCK', b.top, 8, b.width),
        row('B03_LONG_BEAM', b.top + 3, 2, b.width),
        row('B02_MEDIUM_BLOCK', b.top + 4, 4, b.width),
        row('B01_SMALL_BLOCK', b.top + 5, 6, b.width),
      );
    },
  },
  {
    name: 'Ironworks',
    par: 11,
    build() {
      const b = base('triple');
      return on(
        b,
        row('A01_T_BLOCK', b.top, 2, b.width),
        row('B05_LARGE_BLOCK', b.top + 2, 4, b.width),
        row('B02_MEDIUM_BLOCK', b.top + 4, 4, b.width),
        row('B01_SMALL_BLOCK', b.top + 5, 6, b.width),
      );
    },
  },
  {
    name: 'Last Stand',
    par: 12,
    note: 'Steel columns, a stone core and a wooden crown. Everything the kit does.',
    build() {
      const b = base('triple');
      return on(
        b,
        row('S01_ROUND_COLUMN', b.top, 6, b.width),
        row('B03_LONG_BEAM', b.top + 3, 2, b.width),
        row('B05_LARGE_BLOCK', b.top + 4, 4, b.width, { family: 'stone' }),
        row('B02_MEDIUM_BLOCK', b.top + 6, 4, b.width),
        row('B01_SMALL_BLOCK', b.top + 7, 6, b.width),
      );
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

/**
 * Balls a good player needs for a level of this size.
 *
 * Derived from the piece count rather than guessed, because the game is about knocking
 * pieces off rather than destroying them, and the work therefore scales with how many
 * pieces there are. The hand written pars that shipped first were 3 to 12 and were set by
 * eye; on Normal, where the ball allowance is exactly par, every level past the third was
 * unwinnable because a fourteen piece wall cannot be cleared in six shots.
 *
 * 0.9 balls per piece plus two. A good shot brings several pieces down at once, so this is
 * comfortably achievable, and a wasteful player runs out.
 *
 * @param {number} pieces
 * @returns {number}
 */
function parFor(pieces) {
  return Math.max(3, Math.round(pieces * 0.9) + 2);
}

let maxPieces = 0;
DESIGNS.forEach((design, index) => {
  const id = index + 1;
  const built = design.build();
  const pieces = built.pieces.map((p) => {
    const out = { piece: p.piece, x: round(p.x), y: round(p.y) };
    if (p.z !== undefined) out.z = round(p.z);
    if (p.rotY !== undefined) out.rotY = round(p.rotY);
    if (p.family !== undefined) out.family = p.family;
    if (p.fixed !== undefined) out.fixed = p.fixed;
    return out;
  });
  maxPieces = Math.max(maxPieces, pieces.length);

  const level = {
    schema: 2,
    id,
    name: design.name,
    par: parFor(built.pieces.length),
    ...(design.note ? { note: design.note } : {}),
    pedestals: built.pedestals,
    pieces,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, `${String(id).padStart(2, '0')}.json`),
    `${JSON.stringify(level, null, 2)}\n`,
  );
  console.log(
    `${String(id).padStart(2)} ${design.name.padEnd(20)} par ${String(parFor(pieces.length)).padStart(2)}  `
    + `${String(pieces.length).padStart(2)} pieces  ${built.pedestals.length} plinth(s)`,
  );
});

console.log(`\nWrote ${DESIGNS.length} levels to levels/. Largest is ${maxPieces} pieces.`);
console.log('Now run: node scripts/verify-level-support.mjs');
