/**
 * loader.js
 *
 * OWNS: fetching the converted .glb models once, keeping one shared geometry and
 * material set per piece, and handing out cloned meshes for the many instances a level
 * places.
 *
 * MUST NOT OWN: physics, placement or any dimension. Geometry arrives already in
 * Structural Units because scripts/convert-blocks.mjs baked the scale in.
 *
 * Why cloning rather than loading per instance. A level places dozens of pieces, and
 * several levels reuse the same piece. Loading a model per instance would refetch it
 * and would give every instance its own copy of the same buffers. Object3D.clone()
 * shares geometry and material by reference, so twenty crates cost one upload.
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import { PIECES } from './manifest.js';
import { materialFor } from '../render/materials.js';

/** @type {Map<string, Group>} */
const templates = new Map();
/** @type {Map<string, string>} */
const failures = new Map();

/**
 * Loads every piece model.
 *
 * Assumes the conversion step has run, which npm's predev, prebuild and pretest hooks
 * guarantee. Resolves once every model has either loaded or failed; a failure does not
 * reject, because one missing model should cost one piece rather than the whole game.
 * Check `getLoadFailures()` afterwards.
 *
 * @param {string} [baseUrl] Prefix for model URLs. Defaults to the document base.
 * @returns {Promise<{loaded: number, failed: number}>}
 */
export async function loadAllPieceModels(baseUrl = '') {
  const loader = new GLTFLoader();

  const results = await Promise.all(PIECES.map(async (piece) => {
    try {
      const gltf = await loader.loadAsync(`${baseUrl}${piece.modelUrl}`);
      const group = new Group();
      group.name = piece.id;
      // The exported scene may hold several primitives, one per material. They are
      // moved rather than copied so the original scene can be discarded.
      for (const child of [...gltf.scene.children]) group.add(child);
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        // Replace the imported material with the rebuilt one for the same authored
        // name. The V2 FBX files carry material names and per face assignment but no
        // appearance at all, so the name is the only thing worth keeping from them.
        // See the header of src/render/materials.js for why.
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => materialFor(m?.name ?? 'MAT_UNKNOWN'))
          : materialFor(o.material?.name ?? 'MAT_UNKNOWN');
      });
      templates.set(piece.id, group);
      return true;
    } catch (err) {
      failures.set(piece.id, err?.message ?? String(err));
      return false;
    }
  }));

  return {
    loaded: results.filter(Boolean).length,
    failed: results.filter((r) => !r).length,
  };
}

/**
 * Returns a fresh Object3D for a piece, sharing geometry and materials with every other
 * instance of that piece.
 *
 * Falls back to a plain box of the piece's manifest dimensions if the model failed to
 * load, coloured with the family's colour hint, so a level still plays and the missing
 * model is obvious rather than invisible. Never returns null.
 *
 * @param {import('./manifest.js').Piece} piece
 * @param {import('./families.js').Family} family
 * @returns {import('three').Object3D}
 */
export function createPieceMesh(piece, family) {
  const template = templates.get(piece.id);
  if (template) {
    const clone = template.clone(true);
    // Tint is not applied to the model: the V2 materials are the owner's approved art
    // direction and a level override changes physics, not appearance.
    return clone;
  }

  const box = new Mesh(
    new BoxGeometry(piece.width, piece.height, piece.depth),
    new MeshStandardMaterial({ color: family.colorHint, roughness: 0.85, metalness: 0 }),
  );
  // Match the authored pivot so the fallback sits exactly where the model would.
  box.position.y = piece.collider.pivotLift;
  box.castShadow = true;
  box.receiveShadow = true;
  const g = new Group();
  g.add(box);
  g.name = `${piece.id}_fallback`;
  return g;
}

/** Piece ids that failed to load, with the reason. Empty when everything loaded. */
export function getLoadFailures() {
  return new Map(failures);
}

/** True when a piece has a real model rather than the fallback box. */
export function hasModel(pieceId) {
  return templates.has(pieceId);
}

/** Test seam: forget everything loaded. Only used by tests. */
export function resetLoaderForTests() {
  templates.clear();
  failures.clear();
}
