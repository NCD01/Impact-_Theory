/**
 * structure.js
 *
 * OWNS: the pieces a level places, keeping their meshes in step with their bodies,
 * routing impacts to the right piece, fracturing a piece when it runs out of hit
 * points, the fragments that replaces it with, and deciding when a level is cleared.
 *
 * MUST NOT OWN: scoring (src/game/scoring.js), audio, the camera, or the level file
 * format (src/game/level.js). This module answers "what is standing and what is
 * broken".
 *
 * Level clear, stated once and in one place, because the brief requires exactly that.
 * A level is cleared when every non support piece is either destroyed or has come to
 * rest with its centre below PLAYFIELD.REST_HEIGHT_THRESHOLD, or has been knocked
 * outside PLAYFIELD.OUT_OF_PLAY_RADIUS. Supports are excluded, which is what lets a
 * level be cleared by knocking the load off a pair of pedestals while the pedestals
 * themselves survive, exactly as in the reference clip.
 *
 * On fracture, and on not faking it. A piece that runs out of hit points is removed and
 * replaced by three to five smaller rigid bodies that inherit its velocity, plus a dust
 * burst. The fragments are real bodies with mass that land, settle and can be hit
 * again. They are not particles pretending to be debris, and nothing here plays a
 * canned collapse: the pieces above a broken piece fall because nothing is holding them
 * up any more, which is the physics engine's answer and not this module's.
 */

import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';

import { DESTRUCTION, PLAYFIELD } from '../core/constants.js';
import { createDamageState, applyImpact } from '../physics/damage.js';
import { createPieceMesh } from '../blocks/loader.js';
import { getFamily } from '../blocks/families.js';
import { getPiece } from '../blocks/manifest.js';

/**
 * Creates the structure manager for one play session.
 *
 * Assumes `physics` is a PhysicsWorld and `root` is a scene node cleared between
 * levels. `onDestroyed` is called once per piece the moment it fractures, with the
 * piece entry, so the game layer can score it and play a sound.
 *
 * @param {object} deps
 * @param {import('../physics/world.js').PhysicsWorld} deps.physics
 * @param {import('three').Object3D} deps.root
 * @param {ReturnType<typeof import('../render/dust.js').createDust>} deps.dust
 * @param {(entry: object, at: {x:number,y:number,z:number}) => void} deps.onDestroyed
 */
export function createStructure({ physics, root, dust, onDestroyed }) {
  /** Live pieces by body handle. @type {Map<number, PieceEntry>} */
  const pieces = new Map();
  /** Live fragments by body handle. */
  const fragments = new Map();
  /** Shared geometry for fragments, scaled per instance. One upload for all debris. */
  const fragmentGeometry = new BoxGeometry(1, 1, 1);
  /** Material per family, so fragments of one family share a material. */
  const fragmentMaterials = new Map();

  let destroyedCount = 0;
  let targetCount = 0;
  /** Where this level's pieces are placed, SU. Set per level before placing. */
  let origin = [...PLAYFIELD.STRUCTURE_ORIGIN];

  /**
   * @typedef {object} PieceEntry
   * @property {number} handle
   * @property {import('three').Object3D} mesh
   * @property {object} piece    Manifest row.
   * @property {object} family
   * @property {object} damage
   * @property {boolean} isSupport
   * @property {boolean} counted Whether this piece already counted toward clear.
   */

  /**
   * Places one piece.
   *
   * Assumes `spec` has been validated by the level validator, so `spec.piece` is a real
   * manifest id and `spec.family`, if present, is a real family id. Position is in SU
   * relative to the playfield's structure origin, which keeps level files readable and
   * independent of where the structure sits on the field.
   *
   * @param {{piece: string, x: number, y: number, z?: number, rotY?: number,
   *          family?: string, support?: boolean, fixed?: boolean}} spec
   * @returns {PieceEntry}
   */
  function place(spec) {
    const piece = getPiece(spec.piece);
    const family = getFamily(spec.family ?? piece.defaultFamily);
    const isSupport = spec.support === true;

    const position = {
      x: origin[0] + spec.x,
      y: origin[1] + spec.y,
      z: origin[2] + (spec.z ?? 0),
    };

    // Rotation about Y only. Level files stay readable, and a kit of axis aligned
    // blocks has no need for arbitrary orientation.
    const rotY = spec.rotY ?? 0;
    const rotation = rotY === 0
      ? undefined
      : { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };

    const handle = physics.addBody({
      collider: piece.collider,
      family,
      position,
      rotation,
      // A fixed piece is scenery that never moves. Supports are dynamic by default so
      // that knocking one out drops what stands on it.
      fixed: spec.fixed === true,
      kind: 'piece',
      userData: { pieceId: piece.id },
    });

    const mesh = createPieceMesh(piece, family);
    mesh.position.set(position.x, position.y, position.z);
    if (rotation) mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    root.add(mesh);

    const entry = {
      handle,
      mesh,
      piece,
      family,
      damage: createDamageState(family.hitPoints * currentHitPointScale),
      isSupport,
      counted: false,
    };
    pieces.set(handle, entry);
    if (!isSupport) targetCount += 1;
    return entry;
  }

  /**
   * Sets where this level's pieces are placed, in SU.
   *
   * Called once per level before any piece is placed. Short levels are put nearer the
   * cannon so they fill the frame; tall ones further away so they fit in it. This is the
   * lever that works, because fitting a 3 SU structure by moving the camera instead would
   * put the camera in front of its own cannon.
   *
   * @param {[number, number, number]} next
   */
  function setOrigin(next) {
    origin = [...next];
  }

  /** Difficulty's hit point multiplier. Set before a level is built. */
  let currentHitPointScale = 1;
  let currentDamageScale = 1;

  /**
   * Sets the difficulty scaling used for pieces placed afterwards.
   * Difficulty changes these two numbers and nothing else about this module.
   *
   * @param {{hitPointScale: number, damageScale: number}} tuning
   */
  function setDifficultyTuning({ hitPointScale, damageScale }) {
    currentHitPointScale = hitPointScale;
    currentDamageScale = damageScale;
  }

  /**
   * Routes one impact from the physics layer to whichever pieces were involved.
   *
   * Both sides of a collision take damage, which is what makes a falling beam break the
   * block it lands on rather than only itself. Returns the total energy that actually
   * counted, so the caller can scale feedback by it without recomputing.
   *
   * @param {object} impact From PhysicsWorld.step.
   * @returns {number} Energy applied, joules.
   */
  function handleImpact(impact) {
    let applied = 0;
    for (const handle of [impact.handleA, impact.handleB]) {
      if (handle === null) continue;
      const entry = pieces.get(handle);
      if (!entry) continue;
      const result = applyImpact(entry.damage, impact.energy, currentDamageScale);
      applied += result.applied;
      if (result.fractured) {
        fracture(entry);
      } else if (result.applied > 0) {
        tintDamage(entry, result.fraction);
      }
    }
    return applied;
  }

  /**
   * Darkens a piece as it takes damage, so a player can see what is nearly broken.
   * Materials are cloned on first tint, because the loader shares one material across
   * every instance of a piece and tinting the shared one would darken every crate at
   * once.
   */
  function tintDamage(entry, fraction) {
    if (fraction < 0.25) return;
    if (!entry.tinted) {
      entry.mesh.traverse((o) => {
        if (o.isMesh) o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      });
      entry.tinted = true;
    }
    // Multiply toward a dark, slightly warm value so damage reads as scorching and
    // cracking rather than as the piece simply changing colour.
    const k = 1 - fraction * 0.45;
    entry.mesh.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
        m.color.copy(m.userData.baseColor).multiplyScalar(k);
      }
    });
  }

  /**
   * Destroys a piece and replaces it with fragments.
   *
   * Assumes the piece still has a live body. Fragments inherit the parent's linear
   * velocity plus an outward scatter, so debris from a piece that was already falling
   * keeps going the way it was going. Fragment count is capped globally; past the cap a
   * piece still breaks and still throws dust, it just leaves less debris, because the
   * body budget matters more than the last few chips.
   *
   * @param {PieceEntry} entry
   */
  function fracture(entry) {
    const rec = physics.getRecord(entry.handle);
    const at = rec
      ? { ...rec.body.translation() }
      : { x: entry.mesh.position.x, y: entry.mesh.position.y, z: entry.mesh.position.z };
    const vel = rec ? { ...rec.body.linvel() } : { x: 0, y: 0, z: 0 };

    // Dust at the piece's centre of volume, not its origin, or a center-bottom piece
    // puffs at ground level instead of where it broke.
    const centre = {
      x: at.x, y: at.y + entry.piece.collider.pivotLift, z: at.z,
    };
    const scale = Math.min(entry.piece.width, entry.piece.height, entry.piece.depth);
    dust.burst(centre, Math.max(0.6, scale), DESTRUCTION.DUST_PARTICLES);

    spawnFragments(entry, centre, vel);

    physics.removeBody(entry.handle);
    root.remove(entry.mesh);
    pieces.delete(entry.handle);
    destroyedCount += 1;

    onDestroyed(entry, centre);
  }

  function fragmentMaterialFor(family) {
    let m = fragmentMaterials.get(family.id);
    if (!m) {
      m = new MeshStandardMaterial({
        color: family.colorHint, roughness: 0.95, metalness: 0,
      });
      fragmentMaterials.set(family.id, m);
    }
    return m;
  }

  function spawnFragments(entry, centre, parentVelocity) {
    const budget = DESTRUCTION.MAX_FRAGMENTS - fragments.size;
    if (budget <= 0) return;

    const wanted = DESTRUCTION.FRAGMENTS_MIN
      + Math.floor(Math.random() * (DESTRUCTION.FRAGMENTS_MAX - DESTRUCTION.FRAGMENTS_MIN + 1));
    const count = Math.min(wanted, budget);

    const { piece, family } = entry;
    const edge = Math.min(piece.width, piece.height, piece.depth)
      * DESTRUCTION.FRAGMENT_SIZE_FACTOR;

    for (let i = 0; i < count; i += 1) {
      const jitter = 0.7 + Math.random() * 0.6;
      const half = (edge * jitter) / 2;

      const position = {
        x: centre.x + (Math.random() - 0.5) * piece.width * 0.7,
        y: centre.y + (Math.random() - 0.5) * piece.height * 0.7,
        z: centre.z + (Math.random() - 0.5) * piece.depth * 0.7,
      };

      const handle = physics.addBody({
        // A fragment is always a simple box regardless of the shape it came from.
        // Simplified fragment colliders were settled in the phase 3 spike: a compound
        // collider per chip is the fastest way to spend the whole budget on rubble.
        collider: {
          kind: 'cuboid',
          pivotLift: 0,
          halfExtents: { x: half, y: half, z: half },
        },
        family,
        position,
        kind: 'fragment',
        userData: { fragment: true },
      });

      const rec = physics.getRecord(handle);
      if (rec) {
        const s = DESTRUCTION.FRAGMENT_SCATTER_SPEED;
        rec.body.setLinvel({
          x: parentVelocity.x + (Math.random() - 0.5) * s,
          y: parentVelocity.y + Math.random() * s * 0.7,
          z: parentVelocity.z + (Math.random() - 0.5) * s,
        }, true);
        rec.body.setAngvel({
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8,
          z: (Math.random() - 0.5) * 8,
        }, true);
      }

      const mesh = new Mesh(fragmentGeometry, fragmentMaterialFor(family));
      mesh.scale.setScalar(half * 2);
      mesh.castShadow = true;
      mesh.position.set(position.x, position.y, position.z);
      root.add(mesh);

      fragments.set(handle, { handle, mesh, timer: DESTRUCTION.FRAGMENT_LIFETIME_S });
    }
  }

  /**
   * Syncs meshes to bodies and ages out fragments. Call once per rendered frame.
   *
   * Fragments despawn on a timer rather than instantly, and only once they have come to
   * rest, so debris is never seen vanishing mid air.
   *
   * @param {number} dt Seconds.
   */
  function update(dt) {
    for (const entry of pieces.values()) {
      const rec = physics.getRecord(entry.handle);
      if (!rec) continue;
      const t = rec.body.translation();
      const r = rec.body.rotation();
      entry.mesh.position.set(t.x, t.y, t.z);
      entry.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }

    for (const frag of [...fragments.values()]) {
      const rec = physics.getRecord(frag.handle);
      if (!rec) { fragments.delete(frag.handle); continue; }
      const t = rec.body.translation();
      const r = rec.body.rotation();
      frag.mesh.position.set(t.x, t.y, t.z);
      frag.mesh.quaternion.set(r.x, r.y, r.z, r.w);

      // Only age a fragment once it has settled, so nothing disappears mid flight.
      if (rec.body.isSleeping() || t.y < PLAYFIELD.GROUND_Y - 2) {
        frag.timer -= dt;
        if (frag.timer <= 0) {
          physics.removeBody(frag.handle);
          root.remove(frag.mesh);
          fragments.delete(frag.handle);
        }
      }
    }
  }

  /**
   * Whether every non support piece has been destroyed or brought down.
   *
   * This is the single place the clear rule lives. A piece counts as down when its
   * centre of volume is below PLAYFIELD.REST_HEIGHT_THRESHOLD, or when it has been
   * knocked outside the play radius.
   *
   * @returns {boolean}
   */
  function isCleared() {
    for (const entry of pieces.values()) {
      if (entry.isSupport) continue;
      if (!isDown(entry)) return false;
    }
    return true;
  }

  function isDown(entry) {
    const rec = physics.getRecord(entry.handle);
    if (!rec) return true;
    const t = rec.body.translation();
    const centreY = t.y + entry.piece.collider.pivotLift;
    if (centreY < PLAYFIELD.REST_HEIGHT_THRESHOLD) return true;
    const dx = t.x - origin[0];
    const dz = t.z - origin[2];
    return Math.hypot(dx, dz) > PLAYFIELD.OUT_OF_PLAY_RADIUS;
  }

  /** How many non support pieces are still standing. Drives the progress readout. */
  function standingCount() {
    let n = 0;
    for (const entry of pieces.values()) {
      if (!entry.isSupport && !isDown(entry)) n += 1;
    }
    return n;
  }

  /** Removes every piece and fragment. Called between levels. */
  function clear() {
    for (const entry of pieces.values()) {
      physics.removeBody(entry.handle);
      root.remove(entry.mesh);
    }
    for (const frag of fragments.values()) {
      physics.removeBody(frag.handle);
      root.remove(frag.mesh);
    }
    pieces.clear();
    fragments.clear();
    destroyedCount = 0;
    targetCount = 0;
  }

  /**
   * The material family of whichever live piece an impact involved.
   *
   * Used to voice the impact sound, so a ball hitting stone sounds like stone. Returns
   * the first live piece found, because a sound has one voice and a ball-versus-piece
   * contact only ever has one piece in it. Returns null when neither side is a piece,
   * which is what a ball landing on the sand is.
   *
   * @param {object} impact From PhysicsWorld.step.
   * @returns {string|null} Family id.
   */
  function familyOfImpact(impact) {
    for (const handle of [impact.handleA, impact.handleB]) {
      if (handle === null) continue;
      const entry = pieces.get(handle);
      if (entry) return entry.family.id;
    }
    return null;
  }

  return {
    place,
    setOrigin,
    setDifficultyTuning,
    handleImpact,
    familyOfImpact,
    update,
    isCleared,
    standingCount,
    clear,
    get destroyedCount() { return destroyedCount; },
    get targetCount() { return targetCount; },
    get fragmentCount() { return fragments.size; },
    get pieceCount() { return pieces.size; },
    /** Test and debug seam. */
    _pieces: pieces,
  };
}
