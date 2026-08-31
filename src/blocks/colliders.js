/**
 * colliders.js
 *
 * OWNS: the collider shape used for each of the fifteen pieces, derived from the
 * manifest's dimensions rather than from the mesh, and the offset that reconciles a
 * piece's authored pivot with Rapier's collider centres.
 *
 * MUST NOT OWN: mass or material coefficients (src/blocks/families.js), or the act of
 * creating bodies in a world (src/physics/world.js). This file describes shapes.
 *
 * Why dimensions and not the mesh. The manifest is the authority on what a piece
 * measures. Deriving a collider by measuring the loaded mesh would make the physics
 * silently follow any future art change, including a mistaken one, and would make the
 * game behave differently depending on whether the model finished loading.
 *
 * The pivot problem, which is the thing most likely to look like a physics bug.
 * Thirteen pieces are authored with a center-bottom pivot: the origin sits on the base
 * and the geometry runs upward. Two, A03_CROSS_BEAM and A04_ROLLER, use a
 * geometric-center pivot. Rapier's cuboid and cylinder colliders are always centred on
 * their own origin. So a center-bottom piece needs its collider lifted by half its
 * height to line up with its mesh, and a geometric-center piece needs no lift at all.
 * Getting this wrong sinks pieces halfway into the ground.
 */

import { SUPPORT_CAPABLE_PIECES } from './families.js';

/**
 * Collider shape kinds. Kept as strings rather than Rapier constructors so this module
 * has no dependency on Rapier and can be unit tested in Node without loading WebAssembly.
 *
 * @typedef {'cuboid'|'cylinder'|'compound'} ShapeKind
 */

/**
 * Pieces whose silhouette is not a box. Everything not listed here is a cuboid of the
 * manifest's own width, height and depth, which is exact for the box shaped pieces and
 * is the right approximation for the rest.
 *
 * A cylinder is used where the piece is a round column or a roller, because a box
 * collider on a roller cannot roll and a roller that cannot roll is just a small beam.
 *
 * A compound of boxes is used for the pieces with a genuine hole or arm, because a
 * single box would let a ball rest on empty air, and a convex hull would fill in the
 * arch's opening, which is the one feature that makes an arch worth placing.
 */
const SHAPE_OVERRIDES = {
  /** Round column. Radius is half the 1 SU width. Axis is Y, matching the model. */
  S01_ROUND_COLUMN: { kind: 'cylinder', axis: 'y' },

  /**
   * Roller. The model is a 2 x 1 x 1 SU cylinder lying on its side, so its axis runs
   * along X and its radius is half the 1 SU height. Authored with a geometric-center
   * pivot, which is what lets it roll about its own middle.
   */
  A04_ROLLER: { kind: 'cylinder', axis: 'x' },

  /**
   * Arch, 3 x 2 x 1 SU. Two legs and a lintel, leaving an opening a ball can pass
   * through. Parts are expressed as fractions of the piece's own dimensions so they
   * stay correct if the art is ever rebuilt at another size.
   */
  S05_ARCH: {
    kind: 'compound',
    parts: [
      // Left leg: outer third of the width, lower three quarters of the height.
      { fx: -1 / 3, fy: -1 / 8, fz: 0, fw: 1 / 3, fh: 3 / 4, fd: 1 },
      // Right leg, mirrored.
      { fx: 1 / 3, fy: -1 / 8, fz: 0, fw: 1 / 3, fh: 3 / 4, fd: 1 },
      // Lintel across the top.
      { fx: 0, fy: 3 / 8, fz: 0, fw: 1, fh: 1 / 4, fd: 1 },
    ],
  },

  /**
   * T-Block, 3 x 2 x 1 SU. A full width bar across the top and a stem below it.
   */
  A01_T_BLOCK: {
    kind: 'compound',
    parts: [
      { fx: 0, fy: 1 / 4, fz: 0, fw: 1, fh: 1 / 2, fd: 1 },
      { fx: 0, fy: -1 / 4, fz: 0, fw: 1 / 3, fh: 1 / 2, fd: 1 },
    ],
  },

  /**
   * L-Block, 2 x 2 x 1 SU. A vertical arm on the left and a foot along the bottom.
   */
  A02_L_BLOCK: {
    kind: 'compound',
    parts: [
      { fx: -1 / 4, fy: 0, fz: 0, fw: 1 / 2, fh: 1, fd: 1 },
      { fx: 1 / 4, fy: -1 / 4, fz: 0, fw: 1 / 2, fh: 1 / 2, fd: 1 },
    ],
  },

  /**
   * Cross Beam, 3 x 3 x 1 SU, geometric-center pivot. A horizontal and a vertical bar
   * crossing at the middle.
   */
  A03_CROSS_BEAM: {
    kind: 'compound',
    parts: [
      { fx: 0, fy: 0, fz: 0, fw: 1, fh: 1 / 3, fd: 1 },
      { fx: 0, fy: 0, fz: 0, fw: 1 / 3, fh: 1, fd: 1 },
    ],
  },

  /**
   * Mechanical Stabiliser, 3 x 2 x 1 SU. Approximated as a wide base and a narrower
   * upper body. The authored mesh has 3028 triangles of mechanical detail; none of it
   * changes how the piece stacks, so the collider stays simple on purpose.
   */
  A05_MECHANICAL_STABILIZER: {
    kind: 'compound',
    parts: [
      { fx: 0, fy: -1 / 4, fz: 0, fw: 1, fh: 1 / 2, fd: 1 },
      { fx: 0, fy: 1 / 4, fz: 0, fw: 2 / 3, fh: 1 / 2, fd: 1 },
    ],
  },

  /**
   * Wedge, 2 x 1 x 1 SU. A true wedge would be a convex hull, but a hull built from
   * the mesh reintroduces the dependency on art this file exists to avoid. Two stacked
   * boxes of decreasing width give the sloped silhouette that matters for stacking.
   */
  S04_WEDGE: {
    kind: 'compound',
    parts: [
      { fx: 0, fy: -1 / 4, fz: 0, fw: 1, fh: 1 / 2, fd: 1 },
      { fx: -1 / 4, fy: 1 / 4, fz: 0, fw: 1 / 2, fh: 1 / 2, fd: 1 },
    ],
  },
};

/**
 * Builds the collider description for a piece.
 *
 * Assumes `piece` is a row from block_asset_manifest.json, carrying id, width, height,
 * depth and pivot. Returns a plain description, not a Rapier object; src/physics/world.js
 * turns it into colliders. Throws on an unknown pivot kind, because guessing would put
 * the piece in the wrong place and look like a bug somewhere else.
 *
 * `pivotLift` is the amount the collider centre sits above the body origin. Add it to
 * the body's position to find where the shape actually is.
 *
 * @param {{id: string, width: number, height: number, depth: number, pivot: string}} piece
 * @returns {{
 *   id: string, kind: ShapeKind, pivot: string, pivotLift: number,
 *   halfExtents?: {x: number, y: number, z: number},
 *   radius?: number, halfHeight?: number, axis?: string,
 *   parts?: Array<{offset: {x:number,y:number,z:number}, half: {x:number,y:number,z:number}}>,
 *   supportCapable: boolean
 * }}
 */
export function colliderFor(piece) {
  const { id, width: w, height: h, depth: d, pivot } = piece;

  if (pivot !== 'center-bottom' && pivot !== 'geometric-center') {
    throw new Error(`Piece ${id} has unsupported pivot "${pivot}"`);
  }
  // A center-bottom piece has its geometry entirely above the origin, so its centre of
  // volume is half a height up. A geometric-center piece is already centred.
  const pivotLift = pivot === 'center-bottom' ? h / 2 : 0;

  const override = SHAPE_OVERRIDES[id];
  const base = { id, pivot, pivotLift, supportCapable: SUPPORT_CAPABLE_PIECES.has(id) };

  if (!override) {
    return { ...base, kind: 'cuboid', halfExtents: { x: w / 2, y: h / 2, z: d / 2 } };
  }

  if (override.kind === 'cylinder') {
    // Rapier's cylinder is always Y aligned, so an X aligned roller is rotated by the
    // body that carries it. The radius comes from the two axes that are not the axis.
    const radius = override.axis === 'x' ? h / 2 : Math.min(w, d) / 2;
    const halfHeight = override.axis === 'x' ? w / 2 : h / 2;
    return { ...base, kind: 'cylinder', radius, halfHeight, axis: override.axis };
  }

  // Compound. Fractions become absolute offsets and half extents in SU.
  const parts = override.parts.map((p) => ({
    offset: { x: p.fx * w, y: p.fy * h, z: p.fz * d },
    half: { x: (p.fw * w) / 2, y: (p.fh * h) / 2, z: (p.fd * d) / 2 },
  }));
  return { ...base, kind: 'compound', parts };
}

/**
 * Approximate volume of a collider description, in cubic SU.
 *
 * Used to derive mass from a family's density. Rapier can compute mass from density
 * itself, and does; this exists so the level designer's documentation and the tests can
 * state a piece's mass without starting a physics world.
 *
 * Compound parts are summed without subtracting overlaps, so a cross beam whose two
 * bars intersect reads slightly heavy. The error is under ten percent on the two
 * affected pieces and is preferred to a volume that pretends to a precision the
 * collider itself does not have.
 *
 * @param {ReturnType<typeof colliderFor>} c
 * @returns {number}
 */
export function colliderVolume(c) {
  if (c.kind === 'cuboid') {
    return 8 * c.halfExtents.x * c.halfExtents.y * c.halfExtents.z;
  }
  if (c.kind === 'cylinder') {
    return Math.PI * c.radius * c.radius * 2 * c.halfHeight;
  }
  return c.parts.reduce((sum, p) => sum + 8 * p.half.x * p.half.y * p.half.z, 0);
}
