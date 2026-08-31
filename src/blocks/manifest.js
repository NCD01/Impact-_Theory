/**
 * manifest.js
 *
 * OWNS: reading the authored block manifest and presenting the fifteen pieces to the
 * rest of the game, already joined to their default material family and their collider
 * description.
 *
 * MUST NOT OWN: the numbers themselves. Every dimension, pivot and piece name in this
 * game comes from Assets/Art/Blocks/block_asset_manifest.json, which the art pass wrote
 * and which is the authority. Nothing here restates a dimension; if a value is wrong,
 * it is wrong in the manifest and it gets fixed there.
 *
 * The manifest is imported rather than fetched so that the same code path serves the
 * browser and the Node test runner, and so a missing manifest is a build error rather
 * than a blank screen.
 */

import manifestJson from '../../Assets/Art/Blocks/block_asset_manifest.json';
import { colliderFor, colliderVolume } from './colliders.js';
import { defaultFamilyFor, getFamily } from './families.js';

/**
 * @typedef {object} Piece
 * @property {string} id
 * @property {string} name
 * @property {string} category      BASIC, SUPPORT or ADVANCED.
 * @property {number} width         SU.
 * @property {number} height        SU.
 * @property {number} depth         SU.
 * @property {string} pivot         center-bottom or geometric-center.
 * @property {string} defaultFamily Material family id.
 * @property {object} collider      From colliderFor().
 * @property {number} volume        Cubic SU, approximate.
 * @property {string} modelUrl      Path to the converted .glb, relative to the site root.
 */

/** Where convert-blocks.mjs writes its output, relative to the site root. */
const MODEL_DIR = 'models/blocks';

/**
 * The fifteen pieces, in manifest order.
 * @type {Piece[]}
 */
export const PIECES = manifestJson.pieces.map((p) => {
  const defaultFamily = defaultFamilyFor(p.id);
  if (!defaultFamily) {
    throw new Error(
      `Piece ${p.id} is in the manifest but has no default material family. `
      + 'Add one to PIECE_DEFAULT_FAMILY in src/blocks/families.js.',
    );
  }
  // Fail at load rather than at first collision if a family id is misspelled.
  getFamily(defaultFamily);

  const collider = colliderFor(p);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    width: p.width,
    height: p.height,
    depth: p.depth,
    pivot: p.pivot,
    defaultFamily,
    collider,
    volume: colliderVolume(collider),
    modelUrl: `${MODEL_DIR}/${p.id}.glb`,
  };
});

/** @type {Map<string, Piece>} */
const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

/** Every valid piece id. Used by the level validator. */
export const PIECE_IDS = PIECES.map((p) => p.id);

/** 1 SU in metres, from the manifest. Stated once so nothing else assumes it. */
export const STRUCTURAL_UNIT_METRES = manifestJson.structural_unit_meters;

/**
 * Looks up a piece by id.
 *
 * Throws on an unknown id rather than returning undefined, because every caller here
 * would immediately dereference the result, and a thrown error names the bad id while a
 * TypeError names a line in the renderer.
 *
 * @param {string} id
 * @returns {Piece}
 */
export function getPiece(id) {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown piece id "${id}". Not in block_asset_manifest.json.`);
  return p;
}

/**
 * Whether a piece id exists. For the level validator, which needs to report a bad id
 * rather than throw on it.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function hasPiece(id) {
  return BY_ID.has(id);
}
