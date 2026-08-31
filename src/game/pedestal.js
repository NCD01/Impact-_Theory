/**
 * pedestal.js
 *
 * OWNS: the decorative plinths a level's structure stands on. Their look, their fixed
 * collider, and the height everything above them starts at.
 *
 * MUST NOT OWN: the structure itself (src/game/structure.js), or where a level puts its
 * pedestals (the level file).
 *
 * WHY THESE ARE NOT BLOCK KIT PIECES, AND WHY THEY DO NOT MOVE.
 *
 * The first two attempts used kit columns and footings marked as supports, which were
 * dynamic bodies and fell over with everything else. The owner pointed at the reference
 * and said the platform "does not move", and frame 9 settles it: the whole structure has
 * collapsed into rubble on the sand and **both pedestals are still standing perfectly
 * upright and undamaged**. They are scenery, not part of the puzzle.
 *
 * They are also visibly not blocks. They are turned plinths with a flared base, a
 * decorated shaft and a wider cap on top, which is the "top that does not move" the owner
 * described. The block kit contains nothing like that and no new modelling was in scope,
 * so they are built from primitives here.
 *
 * Being fixed changes the game for the better as well as matching the reference. A level
 * on two immovable plinths is a puzzle about the structure, not about knocking the legs
 * out, and a fixed body costs the solver nothing.
 *
 * Colours are read off the reference frames: copper shaft and cap, a blue banded collar,
 * gold trim. They are a description of a shape, not copied art.
 */

import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';

/**
 * Total height of a pedestal, SU. The structure above starts here.
 *
 * 1.6 rather than the 1.2 first tried: at 1.2 with a 0.55 cap the plinths read as squat
 * bollards, where the reference frames show something taller and more slender with the
 * structure clearly lifted off the sand.
 */
export const PEDESTAL_HEIGHT = 1.6;

/** Radius of the cap, SU. Wide enough for a beam to sit on without teetering. */
export const PEDESTAL_CAP_RADIUS = 0.5;

const COLORS = {
  copper: 0xc26a2c,
  copperDark: 0x9c4f1d,
  band: 0x2a9fd4,
  trim: 0xe8a13c,
};

/** One material set shared by every pedestal in a level. */
function createMaterials() {
  return {
    copper: new MeshStandardMaterial({ color: COLORS.copper, roughness: 0.55, metalness: 0 }),
    copperDark: new MeshStandardMaterial({ color: COLORS.copperDark, roughness: 0.6, metalness: 0 }),
    band: new MeshStandardMaterial({ color: COLORS.band, roughness: 0.5, metalness: 0 }),
    trim: new MeshStandardMaterial({ color: COLORS.trim, roughness: 0.45, metalness: 0 }),
  };
}

/**
 * Builds one pedestal mesh.
 *
 * Assembled from stacked cylinders rather than a lathe, because the silhouette is a
 * handful of discs and cones and a lathe profile would be harder to read and no cheaper.
 * The whole thing is about 260 triangles.
 *
 * @param {ReturnType<typeof createMaterials>} materials
 * @returns {Group}
 */
function buildPedestalMesh(materials) {
  const g = new Group();
  const H = PEDESTAL_HEIGHT;

  /** Adds a cylinder section at a height, and returns the top of it. */
  const section = (bottom, height, rBottom, rTop, material, segments = 18) => {
    const m = new Mesh(new CylinderGeometry(rTop, rBottom, height, segments), material);
    m.position.y = bottom + height / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return bottom + height;
  };

  let y = 0;
  // Flared foot.
  y = section(y, H * 0.09, PEDESTAL_CAP_RADIUS, PEDESTAL_CAP_RADIUS * 0.92, materials.copper);
  y = section(y, H * 0.06, PEDESTAL_CAP_RADIUS * 0.92, 0.34, materials.copperDark);
  // Lower shaft.
  y = section(y, H * 0.2, 0.34, 0.29, materials.copper);
  // Decorated collar, the blue band with gold above and below.
  y = section(y, H * 0.04, 0.31, 0.31, materials.trim);
  y = section(y, H * 0.26, 0.3, 0.3, materials.band);
  y = section(y, H * 0.04, 0.31, 0.31, materials.trim);
  // Upper shaft, widening toward the cap.
  y = section(y, H * 0.16, 0.29, 0.36, materials.copper);
  // The cap, the flat top the structure stands on.
  y = section(y, H * 0.06, 0.36, PEDESTAL_CAP_RADIUS * 0.94, materials.copperDark);
  section(y, H - y, PEDESTAL_CAP_RADIUS * 0.94, PEDESTAL_CAP_RADIUS, materials.copper);

  // A gold ring under the cap, which is what reads as decoration at gameplay distance.
  const ring = new Mesh(
    new TorusGeometry(PEDESTAL_CAP_RADIUS * 0.82, 0.035, 6, 20),
    materials.trim,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = H * 0.86;
  ring.castShadow = true;
  g.add(ring);

  return g;
}

/**
 * Places a level's pedestals.
 *
 * Assumes `xs` are positions in SU relative to the structure origin, and that `origin` is
 * that origin in world space. Creates a fixed body and a mesh for each. Returns a handle
 * with the height structures should start at and a `clear()` for level teardown.
 *
 * The colliders are cylinders matching the cap radius rather than the narrow shaft, so a
 * piece resting on the cap is carried by the whole cap and does not slide off the waist.
 *
 * @param {object} deps
 * @param {import('../physics/world.js').PhysicsWorld} deps.physics
 * @param {import('three').Object3D} deps.root
 * @param {number[]} xs
 * @param {[number, number, number]} origin
 */
export function placePedestals({ physics, root, xs, origin }) {
  const materials = createMaterials();
  const template = buildPedestalMesh(materials);
  const handles = [];
  const meshes = [];

  for (const x of xs) {
    const position = { x: origin[0] + x, y: origin[1], z: origin[2] };

    const handle = physics.addBody({
      collider: {
        kind: 'cylinder',
        pivotLift: PEDESTAL_HEIGHT / 2,
        radius: PEDESTAL_CAP_RADIUS,
        halfHeight: PEDESTAL_HEIGHT / 2,
        axis: 'y',
      },
      // Density is irrelevant on a fixed body; friction and restitution are not, because
      // pieces rest and slide on the cap. High friction, almost no bounce.
      family: { density: 1000, friction: 0.95, restitution: 0.02 },
      position,
      fixed: true,
      kind: 'pedestal',
      userData: { pedestal: true },
    });
    handles.push(handle);

    const mesh = template.clone(true);
    mesh.position.set(position.x, position.y, position.z);
    root.add(mesh);
    meshes.push(mesh);
  }

  function clear() {
    for (const h of handles) physics.removeBody(h);
    for (const m of meshes) root.remove(m);
    handles.length = 0;
    meshes.length = 0;
    for (const m of Object.values(materials)) m.dispose();
  }

  return { top: PEDESTAL_HEIGHT, count: xs.length, clear };
}
