/**
 * families.js
 *
 * OWNS: the seven physics material families, the per family constants that decide how a
 * piece weighs, bounces, grips and breaks, and the mapping from piece ID to family.
 *
 * MUST NOT OWN: geometry, collider shapes (src/blocks/colliders.js), or how damage is
 * accumulated (src/physics/damage.js). This file answers "what is this made of", not
 * "what is happening to it".
 *
 * Units. Density is kilograms per cubic SU, and 1 SU is 1 metre, so it is kg/m^3.
 * Hit points are joules of accumulated impact energy needed to destroy a piece.
 * Restitution and friction are Rapier's dimensionless coefficients, 0 to 1 and up.
 *
 * HOW THE HIT POINT NUMBERS WERE CHOSEN, because the first set was wrong by two orders
 * of magnitude and the way it was wrong is worth not repeating.
 *
 * They were first guessed, at 900 J for wood up to 4200 for steel. Every structure then
 * vaporised on contact: a forty piece wall went from standing to nothing in about a
 * second, because a ball hit turned out to deliver far more energy than any of those
 * numbers. So the real distribution was measured instead, by logging every impact the
 * simulation reported during a settle and during a collapse:
 *
 *   Structure standing, no shots     4613 impacts, 100 percent under 10 J, max 5 J
 *   Six shots and the collapse       8144 impacts, 92.6 percent under 10 J,
 *                                    p99 417 J, and a tail of 32 impacts above 2000 J
 *                                    reaching a maximum of 54057 J
 *
 * So a square ball hit is worth roughly 5000 to 50000 J, a glancing hit a few hundred,
 * and a piece settling against its neighbour under 10 J. The values below are set
 * against that measured scale, so that a square hit destroys wood outright, brick takes
 * two, and steel takes a sustained beating, while the jostling of a collapse chips
 * pieces without dissolving the structure. That is what produces the reference clip's
 * behaviour, where blocks mostly tumble and some of them break.
 *
 * On the density values. These are not the real densities of the materials they are
 * named after. Real steel is 7850 kg/m^3, which makes a 1 SU steel cube weigh nearly
 * eight tonnes and immovable by any ball a child would believe in. The values below
 * preserve the ordering and the feel of the real materials while compressing the range
 * to roughly three to one, so that every family is movable and heavy things still feel
 * heavy. This is a game value, chosen deliberately, not a mistake about physics.
 *
 * The family assigned to each piece is the owner's approved V2 art direction, read from
 * Assets/Art/Blocks/MaterialVariants/V2/material_variant_manifest_v2.json. The art and
 * the physics agree, so a piece that looks like brick behaves like brick.
 */

/**
 * @typedef {object} Family
 * @property {string} id            Stable key used in level files and save data.
 * @property {string} label         Player facing name.
 * @property {number} density       kg per cubic SU.
 * @property {number} restitution   Bounciness, 0 is dead, 1 is lossless.
 * @property {number} friction      Surface grip.
 * @property {number} hitPoints     Joules of impact energy to destroy.
 * @property {number} scoreWeight   Multiplier on the base points for destroying it.
 * @property {number} colorHint     Fallback colour if the model fails to load, hex.
 */

/** @type {Record<string, Family>} */
export const FAMILIES = {
  wood: {
    id: 'wood',
    label: 'Wood',
    // Lightest family. Crates should shift when a ball clips them.
    density: 340,
    // Wood knocks rather than bounces.
    restitution: 0.16,
    friction: 0.62,
    // Breaks in roughly one square hit from a full speed ball, which carries about
    // 37 kJ, minus what the ball keeps after the collision.
    // One square ball hit. A crate is the piece a player expects to explode.
    hitPoints: 8000,
    scoreWeight: 1.0,
    colorHint: 0xc98b45,
  },

  brick: {
    id: 'brick',
    label: 'Brick',
    density: 720,
    restitution: 0.1,
    friction: 0.78,
    // Brick is the first family that needs a second hit.
    // Two solid hits, or one hit and a heavy piece landing on it.
    hitPoints: 18000,
    scoreWeight: 1.4,
    colorHint: 0xa8452f,
  },

  stone: {
    id: 'stone',
    label: 'Stone',
    density: 900,
    restitution: 0.08,
    friction: 0.84,
    hitPoints: 30000,
    scoreWeight: 1.8,
    colorHint: 0x6f7480,
  },

  concrete: {
    id: 'concrete',
    label: 'Concrete',
    density: 820,
    restitution: 0.09,
    friction: 0.8,
    hitPoints: 24000,
    scoreWeight: 1.6,
    colorHint: 0x9a9a92,
  },

  steel: {
    id: 'steel',
    label: 'Steel',
    // Heaviest family. A steel column anchors a structure and resists being shifted.
    density: 1150,
    restitution: 0.22,
    friction: 0.5,
    // The toughest family. A steel column is meant to survive being shot and to be
    // beaten only by repeated direct hits, so that it reads as the thing holding the
    // structure up rather than as one more block.
    hitPoints: 60000,
    scoreWeight: 2.4,
    colorHint: 0x8d949c,
  },

  paintedSteel: {
    id: 'paintedSteel',
    label: 'Painted Steel',
    // Slightly lighter and softer than bare steel, so painted beams are the tough
    // structural member a player can still eventually break.
    density: 1050,
    restitution: 0.2,
    friction: 0.54,
    hitPoints: 40000,
    scoreWeight: 2.1,
    colorHint: 0xd4762e,
  },

  rubber: {
    id: 'rubber',
    label: 'Rubber',
    density: 420,
    // The one family that genuinely bounces. A ball off a roller goes somewhere else,
    // which is the point of having a roller in a structure.
    restitution: 0.72,
    friction: 0.9,
    // Rubber absorbs rather than breaks, so it takes a lot and is worth little.
    hitPoints: 35000,
    scoreWeight: 1.2,
    colorHint: 0x3c3a3d,
  },
};

/**
 * Default family per piece, from the owner's approved V2 art direction.
 * A level file may override a piece's family; this is what it gets otherwise.
 *
 * @type {Record<string, string>}
 */
export const PIECE_DEFAULT_FAMILY = {
  B01_SMALL_BLOCK: 'wood',
  B02_MEDIUM_BLOCK: 'wood',
  B03_LONG_BEAM: 'paintedSteel',
  B04_TALL_BLOCK: 'brick',
  B05_LARGE_BLOCK: 'concrete',
  S01_ROUND_COLUMN: 'steel',
  S02_SHORT_COLUMN: 'concrete',
  S03_WIDE_FOOTING: 'stone',
  S04_WEDGE: 'stone',
  S05_ARCH: 'brick',
  A01_T_BLOCK: 'paintedSteel',
  A02_L_BLOCK: 'paintedSteel',
  A03_CROSS_BEAM: 'steel',
  A04_ROLLER: 'rubber',
  A05_MECHANICAL_STABILIZER: 'paintedSteel',
};

/**
 * Pieces that may act as structural supports, meaning the things a structure stands on.
 * Level clear ignores supports, so knocking every crate off a pair of columns clears
 * the level even though the columns are still standing, exactly as in the reference
 * clip where the pedestals survive.
 *
 * A piece is only a support when a level file marks it as one. Membership here is what
 * makes that legal, not what makes it happen.
 */
export const SUPPORT_CAPABLE_PIECES = new Set([
  'S01_ROUND_COLUMN',
  'S02_SHORT_COLUMN',
  'S03_WIDE_FOOTING',
]);

/**
 * Returns the family record for a family id.
 *
 * Assumes the id came from a validated level file or from PIECE_DEFAULT_FAMILY.
 * Throws on an unknown id rather than substituting a default, because a silent
 * substitution would make a typo in a level file look like a physics bug.
 *
 * @param {string} id
 * @returns {Family}
 */
export function getFamily(id) {
  const f = FAMILIES[id];
  if (!f) {
    throw new Error(
      `Unknown material family "${id}". Known families: ${Object.keys(FAMILIES).join(', ')}`,
    );
  }
  return f;
}

/**
 * Returns the default family id for a piece id, or undefined if the piece is unknown.
 *
 * @param {string} pieceId
 * @returns {string|undefined}
 */
export function defaultFamilyFor(pieceId) {
  return PIECE_DEFAULT_FAMILY[pieceId];
}

/** All family ids, stable order, for tests and documentation generation. */
export const FAMILY_IDS = Object.keys(FAMILIES);
