/**
 * block-manifest.test.js
 *
 * Covers: that the fifteen pieces the game loads still match the authored manifest on
 * dimensions and pivot, that the conversion step produced a .glb for every one of them,
 * and that every piece has a material family and a sane collider.
 *
 * Why this suite matters more than it looks. The .glb files are generated from FBX by
 * scripts/convert-blocks.mjs, and a conversion that silently shifts a pivot turns every
 * level into a leaning tower while every other test still passes. This is the test that
 * catches that.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PIECES, PIECE_IDS, STRUCTURAL_UNIT_METRES, getPiece, hasPiece } from '../../src/blocks/manifest.js';
import { FAMILIES, PIECE_DEFAULT_FAMILY, getFamily } from '../../src/blocks/families.js';
import { colliderVolume } from '../../src/blocks/colliders.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT_PATH = path.join(REPO_ROOT, 'public', 'models', 'blocks', 'conversion-report.json');

/** The manifest's own table, restated here on purpose so the test is independent. */
const EXPECTED = {
  B01_SMALL_BLOCK: [1, 1, 1, 'center-bottom'],
  B02_MEDIUM_BLOCK: [2, 1, 1, 'center-bottom'],
  B03_LONG_BEAM: [4, 1, 1, 'center-bottom'],
  B04_TALL_BLOCK: [1, 3, 1, 'center-bottom'],
  B05_LARGE_BLOCK: [2, 2, 1, 'center-bottom'],
  S01_ROUND_COLUMN: [1, 3, 1, 'center-bottom'],
  S02_SHORT_COLUMN: [1, 2, 1, 'center-bottom'],
  S03_WIDE_FOOTING: [3, 0.5, 1, 'center-bottom'],
  S04_WEDGE: [2, 1, 1, 'center-bottom'],
  S05_ARCH: [3, 2, 1, 'center-bottom'],
  A01_T_BLOCK: [3, 2, 1, 'center-bottom'],
  A02_L_BLOCK: [2, 2, 1, 'center-bottom'],
  A03_CROSS_BEAM: [3, 3, 1, 'geometric-center'],
  A04_ROLLER: [2, 1, 1, 'geometric-center'],
  A05_MECHANICAL_STABILIZER: [3, 2, 1, 'center-bottom'],
};

describe('block manifest', () => {
  it('has exactly fifteen pieces', () => {
    expect(PIECES).toHaveLength(15);
  });

  it('uses one Structural Unit per metre', () => {
    expect(STRUCTURAL_UNIT_METRES).toBe(1);
  });

  it.each(Object.entries(EXPECTED))(
    '%s matches the manifest table on dimensions and pivot',
    (id, [w, h, d, pivot]) => {
      const p = getPiece(id);
      expect(p.width).toBe(w);
      expect(p.height).toBe(h);
      expect(p.depth).toBe(d);
      expect(p.pivot).toBe(pivot);
    },
  );

  it('has no piece ids beyond the expected fifteen', () => {
    expect(PIECE_IDS.slice().sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('reports unknown ids rather than inventing a piece', () => {
    expect(hasPiece('NOT_A_PIECE')).toBe(false);
    expect(() => getPiece('NOT_A_PIECE')).toThrow(/Unknown piece id/);
  });
});

describe('material families', () => {
  it('gives every piece a family that exists', () => {
    for (const p of PIECES) {
      expect(Object.keys(FAMILIES)).toContain(p.defaultFamily);
      expect(() => getFamily(p.defaultFamily)).not.toThrow();
    }
  });

  it('assigns families matching the approved V2 art direction', () => {
    // From Assets/Art/Blocks/V2_README.md and the V2 variant manifest.
    expect(PIECE_DEFAULT_FAMILY.B01_SMALL_BLOCK).toBe('wood');
    expect(PIECE_DEFAULT_FAMILY.B02_MEDIUM_BLOCK).toBe('wood');
    expect(PIECE_DEFAULT_FAMILY.B03_LONG_BEAM).toBe('paintedSteel');
    expect(PIECE_DEFAULT_FAMILY.B04_TALL_BLOCK).toBe('brick');
    expect(PIECE_DEFAULT_FAMILY.B05_LARGE_BLOCK).toBe('concrete');
    expect(PIECE_DEFAULT_FAMILY.S01_ROUND_COLUMN).toBe('steel');
    expect(PIECE_DEFAULT_FAMILY.S02_SHORT_COLUMN).toBe('concrete');
    expect(PIECE_DEFAULT_FAMILY.S03_WIDE_FOOTING).toBe('stone');
    expect(PIECE_DEFAULT_FAMILY.S04_WEDGE).toBe('stone');
    expect(PIECE_DEFAULT_FAMILY.S05_ARCH).toBe('brick');
    expect(PIECE_DEFAULT_FAMILY.A03_CROSS_BEAM).toBe('steel');
    expect(PIECE_DEFAULT_FAMILY.A04_ROLLER).toBe('rubber');
  });

  it('gives every family positive physical values', () => {
    for (const f of Object.values(FAMILIES)) {
      expect(f.density).toBeGreaterThan(0);
      expect(f.hitPoints).toBeGreaterThan(0);
      expect(f.friction).toBeGreaterThan(0);
      expect(f.restitution).toBeGreaterThanOrEqual(0);
      expect(f.restitution).toBeLessThan(1);
      expect(f.scoreWeight).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown family rather than substituting a default', () => {
    expect(() => getFamily('adamantium')).toThrow(/Unknown material family/);
  });
});

describe('colliders', () => {
  it('lifts center-bottom pieces by half their height and geometric-center by nothing', () => {
    for (const p of PIECES) {
      const expected = p.pivot === 'geometric-center' ? 0 : p.height / 2;
      expect(p.collider.pivotLift).toBeCloseTo(expected, 6);
    }
  });

  it('gives the round column and the roller cylinder colliders', () => {
    expect(getPiece('S01_ROUND_COLUMN').collider.kind).toBe('cylinder');
    expect(getPiece('A04_ROLLER').collider.kind).toBe('cylinder');
    // The roller lies on its side, so its long axis is X.
    expect(getPiece('A04_ROLLER').collider.axis).toBe('x');
    expect(getPiece('S01_ROUND_COLUMN').collider.axis).toBe('y');
  });

  it('gives the arch a compound collider with an opening', () => {
    const arch = getPiece('S05_ARCH').collider;
    expect(arch.kind).toBe('compound');
    // A single box would fill the opening, which is the whole point of an arch.
    expect(arch.parts.length).toBeGreaterThan(1);
    expect(colliderVolume(arch)).toBeLessThan(3 * 2 * 1);
  });

  it('keeps every collider inside its piece bounding box', () => {
    for (const p of PIECES) {
      const c = p.collider;
      if (c.kind === 'cuboid') {
        expect(c.halfExtents.x * 2).toBeCloseTo(p.width, 6);
        expect(c.halfExtents.y * 2).toBeCloseTo(p.height, 6);
        expect(c.halfExtents.z * 2).toBeCloseTo(p.depth, 6);
      } else if (c.kind === 'compound') {
        for (const part of c.parts) {
          expect(Math.abs(part.offset.x) + part.half.x).toBeLessThanOrEqual(p.width / 2 + 1e-6);
          expect(Math.abs(part.offset.y) + part.half.y).toBeLessThanOrEqual(p.height / 2 + 1e-6);
          expect(Math.abs(part.offset.z) + part.half.z).toBeLessThanOrEqual(p.depth / 2 + 1e-6);
        }
      }
    }
  });

  it('gives every piece a positive volume', () => {
    for (const p of PIECES) expect(p.volume).toBeGreaterThan(0);
  });
});

describe('converted models', () => {
  const report = fs.existsSync(REPORT_PATH)
    ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'))
    : null;

  it('has a conversion report, produced by npm run convert:blocks', () => {
    expect(
      report,
      `No conversion report at ${REPORT_PATH}. Run: npm run convert:blocks`,
    ).not.toBeNull();
  });

  it('converted all fifteen pieces without a conformance failure', () => {
    expect(report.failCount).toBe(0);
    expect(report.passCount).toBe(15);
  });

  it('produced a .glb on disk for every piece', () => {
    for (const p of PIECES) {
      const glb = path.join(REPO_ROOT, 'public', 'models', 'blocks', `${p.id}.glb`);
      expect(fs.existsSync(glb), `missing converted model for ${p.id}`).toBe(true);
      expect(fs.statSync(glb).size).toBeGreaterThan(0);
    }
  });

  it('measured every converted piece to the manifest dimensions', () => {
    for (const row of report.pieces) {
      const [w, h, d] = EXPECTED[row.id];
      expect(row.measured.width, `${row.id} width`).toBeCloseTo(w, 3);
      expect(row.measured.height, `${row.id} height`).toBeCloseTo(h, 3);
      expect(row.measured.depth, `${row.id} depth`).toBeCloseTo(d, 3);
    }
  });

  it('kept every pivot where the manifest says it is', () => {
    for (const row of report.pieces) {
      const [, h, , pivot] = EXPECTED[row.id];
      const expectedMinY = pivot === 'geometric-center' ? -h / 2 : 0;
      expect(row.measured.minY, `${row.id} pivot`).toBeCloseTo(expectedMinY, 3);
    }
  });

  it('kept draw calls per piece low enough to build a structure from', () => {
    // Before merging material groups the worst piece needed 261 draw calls. A level
    // places dozens of pieces, so this is the difference between shipping and not.
    for (const row of report.pieces) {
      expect(row.drawCalls, `${row.id} draw calls`).toBeLessThanOrEqual(8);
    }
  });
});
