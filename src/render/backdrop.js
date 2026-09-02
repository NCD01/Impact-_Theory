/**
 * backdrop.js
 *
 * OWNS: the beach behind the playfield. The sea, the palms, the hut, the bunting and the
 * clouds. Everything a player sees past the structure and never interacts with.
 *
 * MUST NOT OWN: the ground the game is played on (src/render/scene.js), or any physics.
 * Nothing here has a collider and nothing here can be hit.
 *
 * Built from primitives in code, because the block kit contains no environment art and no
 * new modelling was in scope. It is a description of what the reference clip shows, not a
 * copy of it: a band of sea across the horizon, palms clustered left and right, a small
 * hut, a line of bunting, and a few clouds.
 *
 * Cheap on purpose. It sits 40 to 60 SU behind the play area, casts and receives no
 * shadows, and uses no textures. The whole backdrop is around 2000 triangles and one draw
 * call per material, so it costs almost nothing on the phone this is aimed at, which is
 * what lets it exist at all inside the body and frame budget from the phase 3 spike.
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';

/** Colours, chosen to sit behind the playfield without competing with it. */
const COLORS = {
  sea: 0x2aa3c4,
  seaFar: 0x1d7fa0,
  foam: 0xdff2f7,
  trunk: 0x8a6338,
  frond: 0x2f9448,
  frondDark: 0x217038,
  hutWall: 0xc98b45,
  hutRoof: 0xa8703a,
  cloud: 0xffffff,
  bunting: [0xe2503f, 0xf0b429, 0x2f9448, 0x2f7fc4, 0xe86ea4],
};

/** How far behind the playfield the backdrop sits, SU. Well past any level. */
const BACKDROP_Z = -40;

/**
 * Builds one palm tree.
 *
 * A leaning trunk of stacked segments and a crown of flattened cones. Around 200
 * triangles. The lean is passed in so a row of palms does not read as a row of identical
 * copies, which is the thing that makes cheap background art look cheap.
 *
 * @param {object} materials
 * @param {number} lean Radians of tilt.
 * @param {number} height SU.
 */
function buildPalm(materials, lean, height) {
  const palm = new Group();

  const segments = 5;
  for (let i = 0; i < segments; i += 1) {
    const t = i / segments;
    const seg = new Mesh(
      new CylinderGeometry(0.22 - t * 0.08, 0.28 - t * 0.08, height / segments, 7),
      materials.trunk,
    );
    // Each segment leans a little more than the last, so the trunk curves rather than
    // tilting as one rigid pole.
    seg.position.set(
      Math.sin(lean * t) * height * t * 0.5,
      (i + 0.5) * (height / segments),
      0,
    );
    seg.rotation.z = -lean * t;
    palm.add(seg);
  }

  const crownX = Math.sin(lean) * height * 0.5;
  const crown = new Group();
  crown.position.set(crownX, height, 0);
  palm.add(crown);

  // Fronds: flattened cones fanned around the crown and drooping.
  const frondCount = 7;
  for (let i = 0; i < frondCount; i += 1) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frond = new Mesh(
      new ConeGeometry(0.42, 2.6, 4),
      i % 2 === 0 ? materials.frond : materials.frondDark,
    );
    frond.scale.set(1, 1, 0.25);
    frond.position.set(Math.cos(angle) * 1.05, 0.35, Math.sin(angle) * 1.05);
    frond.rotation.set(Math.PI / 2.6, -angle, 0);
    crown.add(frond);
  }

  // A few coconuts, which is the detail that says palm rather than umbrella.
  for (let i = 0; i < 3; i += 1) {
    const nut = new Mesh(new SphereGeometry(0.16, 6, 5), materials.trunk);
    nut.position.set(Math.cos(i * 2.1) * 0.28, 0.05, Math.sin(i * 2.1) * 0.28);
    crown.add(nut);
  }

  return palm;
}

/** Builds the lifeguard hut: a box on stilts with a pitched roof. */
function buildHut(materials) {
  const hut = new Group();

  for (const side of [-1, 1]) {
    for (const depth of [-1, 1]) {
      const leg = new Mesh(new CylinderGeometry(0.13, 0.13, 1.8, 6), materials.trunk);
      leg.position.set(side * 1.1, 0.9, depth * 0.8);
      hut.add(leg);
    }
  }

  const body = new Mesh(new BoxGeometry(2.8, 1.9, 2.2), materials.hutWall);
  body.position.y = 2.75;
  hut.add(body);

  const roof = new Mesh(new ConeGeometry(2.5, 1.3, 4), materials.hutRoof);
  roof.position.y = 4.35;
  roof.rotation.y = Math.PI / 4;
  hut.add(roof);

  return hut;
}

/**
 * Builds a line of bunting: triangles strung between two points, sagging in the middle.
 *
 * The sag is a parabola rather than a straight line, because a straight string of flags
 * reads as a graphic and a sagging one reads as string.
 */
function buildBunting(materials, span, sag, count) {
  const g = new Group();
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const x = (t - 0.5) * span;
    // Parabolic droop, deepest at the middle.
    const y = -sag * 4 * t * (1 - t);
    const flag = new Mesh(
      new ConeGeometry(0.3, 0.62, 3),
      materials.bunting[i % materials.bunting.length],
    );
    // Point down, and tilt with the slope of the string so the flags hang naturally.
    flag.rotation.set(Math.PI, 0, Math.atan(sag * 4 * (2 * t - 1) / span) * 2);
    flag.position.set(x, y - 0.3, 0);
    g.add(flag);
  }
  return g;
}

/**
 * Adds the backdrop to a scene.
 *
 * Assumes `parent` lives for the whole session; the backdrop is built once and never
 * torn down between levels. Returns a handle with a `dispose()` for shutdown.
 *
 * @param {import('three').Object3D} parent
 */
export function createBackdrop(parent) {
  const materials = {
    sea: new MeshStandardMaterial({ color: COLORS.sea, roughness: 0.35, metalness: 0 }),
    seaFar: new MeshStandardMaterial({ color: COLORS.seaFar, roughness: 0.3, metalness: 0 }),
    foam: new MeshStandardMaterial({ color: COLORS.foam, roughness: 0.9, metalness: 0 }),
    trunk: new MeshStandardMaterial({ color: COLORS.trunk, roughness: 0.9, metalness: 0 }),
    frond: new MeshStandardMaterial({ color: COLORS.frond, roughness: 0.85, metalness: 0 }),
    frondDark: new MeshStandardMaterial({ color: COLORS.frondDark, roughness: 0.85, metalness: 0 }),
    hutWall: new MeshStandardMaterial({ color: COLORS.hutWall, roughness: 0.9, metalness: 0 }),
    hutRoof: new MeshStandardMaterial({ color: COLORS.hutRoof, roughness: 0.9, metalness: 0 }),
    cloud: new MeshStandardMaterial({ color: COLORS.cloud, roughness: 1, metalness: 0 }),
    bunting: COLORS.bunting.map(
      (c) => new MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0 }),
    ),
  };

  const root = new Group();
  root.name = 'backdrop';
  // Nothing back here casts or receives shadows. The shadow frustum is sized to the
  // playfield, so including the backdrop would either spread its texels over five times
  // the area or drop the backdrop out of the map entirely, and neither buys anything at
  // this distance.
  root.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  parent.add(root);

  // ---- The sea -----------------------------------------------------------
  // Two bands: a nearer brighter one and a darker one behind, which reads as depth for
  // the cost of a second quad.
  const sea = new Mesh(new PlaneGeometry(420, 60), materials.sea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.04, BACKDROP_Z - 32);
  root.add(sea);

  const seaFar = new Mesh(new PlaneGeometry(420, 90), materials.seaFar);
  seaFar.rotation.x = -Math.PI / 2;
  seaFar.position.set(0, 0.03, BACKDROP_Z - 95);
  root.add(seaFar);

  // A pale strip where the water meets the sand, which is what makes the sea sit behind
  // the beach rather than float on it.
  const foam = new Mesh(new PlaneGeometry(420, 2.2), materials.foam);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.05, BACKDROP_Z - 2.5);
  root.add(foam);

  // ---- Palms -------------------------------------------------------------
  // Clustered left and right with a gap in the middle, so the structure is never framed
  // against a tree. Positions are fixed rather than random: the backdrop must look the
  // same every time a level loads.
  const palms = [
    { x: -21, z: 3, lean: 0.22, h: 11 },
    { x: -16, z: -3, lean: -0.16, h: 9 },
    { x: -11.5, z: 1, lean: 0.3, h: 12.5 },
    { x: -7.5, z: -5, lean: -0.24, h: 8.5 },
    { x: 8, z: -4, lean: 0.18, h: 9 },
    { x: 12, z: 2, lean: -0.28, h: 12 },
    { x: 17, z: -2, lean: 0.26, h: 10 },
    { x: 22, z: 4, lean: -0.2, h: 11 },
  ];
  for (const p of palms) {
    const palm = buildPalm(materials, p.lean, p.h);
    palm.position.set(p.x, 0, BACKDROP_Z + p.z);
    root.add(palm);
  }

  // ---- The hut -----------------------------------------------------------
  const hut = buildHut(materials);
  hut.position.set(19, 0, BACKDROP_Z + 4);
  hut.rotation.y = -0.35;
  root.add(hut);

  // ---- Bunting -----------------------------------------------------------
  // Strung between the palm crowns, which is where the reference clip hangs it.
  const bunting = buildBunting(materials, 15, 1.8, 12);
  bunting.position.set(-14, 9.5, BACKDROP_Z + 2);
  root.add(bunting);

  const bunting2 = buildBunting(materials, 13, 1.4, 10);
  bunting2.position.set(14.5, 9.2, BACKDROP_Z + 1);
  root.add(bunting2);

  // ---- Clouds ------------------------------------------------------------
  // Flattened spheres in loose clumps, well above the horizon and far back.
  const clouds = [
    { x: -30, y: 20, z: -30, s: 5 },
    { x: -12, y: 26, z: -50, s: 6.5 },
    { x: 8, y: 22, z: -36, s: 4.5 },
    { x: 26, y: 28, z: -55, s: 7 },
    { x: 40, y: 19, z: -28, s: 5.5 },
  ];
  for (const c of clouds) {
    const clump = new Group();
    for (let i = 0; i < 4; i += 1) {
      const puff = new Mesh(new SphereGeometry(1, 8, 6), materials.cloud);
      puff.scale.set(c.s * (0.6 + i * 0.16), c.s * 0.42, c.s * 0.5);
      puff.position.set((i - 1.5) * c.s * 0.62, Math.sin(i) * c.s * 0.1, 0);
      clump.add(puff);
    }
    clump.position.set(c.x, c.y, BACKDROP_Z + c.z);
    root.add(clump);
  }

  function dispose() {
    root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of Object.values(materials)) {
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
    parent.remove(root);
  }

  return { root, dispose };
}
