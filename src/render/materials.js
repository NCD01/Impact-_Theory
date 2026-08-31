/**
 * materials.js
 *
 * OWNS: the visual appearance of every material name the block kit assigns, rebuilt as
 * procedurally generated canvas textures.
 *
 * MUST NOT OWN: physics. A material's density, friction, restitution and toughness are
 * in src/blocks/families.js and have nothing to do with this file. A level override
 * changes physics, not appearance.
 *
 * WHY THIS FILE EXISTS, which is a finding worth reading before changing anything here.
 *
 * The V2 materialized FBX files carry material *names* and per face material
 * *assignment*, but no appearance at all. Every material in every one of the fifteen
 * files reads back as MeshPhongMaterial with colour #cccccc, no texture map and no
 * useful specular. Measured by loading all fifteen with FBXLoader and printing each
 * material.
 *
 * That is not a defect in the art. The V2 look was authored as procedural Blender node
 * materials, which is why `Art/Materials/V2/V2_MATERIAL_LIBRARY.blend` exists and why
 * the preview PNGs show wood grain and brick courses. FBX has no way to carry a
 * procedural node graph, so the export preserved the half it could: which faces are
 * wood and which are end grain, which are painted and which are bare steel.
 *
 * Baking the real materials to texture files would need Blender, which is not installed
 * on this machine. So the appearance is rebuilt here in code, keyed to the same twelve
 * material names the art pass assigned, with colours read off the V2 preview renders in
 * `Assets/Art/Blocks/Previews/V2/`. The per face assignment the FBX did preserve is
 * what makes this work: end grain still lands on the ends of a beam, and the painted
 * yellow still lands on the stabiliser's feet, because the art said so.
 *
 * This is an approximation of the owner's approved art direction, not the direction
 * itself. It is recorded as such in HANDOFF.md.
 */

import {
  CanvasTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** Texture resolution. Small on purpose: these are flat stylised surfaces seen at a
 *  distance on a phone, and twelve 256 px textures cost under a megabyte of memory. */
const TEX = 256;

/**
 * Colours read from the V2 preview renders under Assets/Art/Blocks/Previews/V2/.
 * `base` is the surface, `detail` the grain, mortar, speckle or veining drawn over it.
 */
const PALETTE = {
  MAT_WOOD: { base: '#c9843f', detail: '#8f5522', kind: 'woodGrain', rough: 0.78 },
  MAT_WOOD_END_GRAIN: { base: '#b06f2f', detail: '#6d3f18', kind: 'woodRings', rough: 0.82 },
  MAT_BRICK: { base: '#bd4b30', detail: '#e8dcc6', kind: 'brick', rough: 0.9 },
  MAT_CONCRETE: { base: '#bab5a9', detail: '#9c978b', kind: 'speckle', rough: 0.95 },
  MAT_STONE: { base: '#d2d0ca', detail: '#a9a7a1', kind: 'marble', rough: 0.72 },
  MAT_STONE_CUT_FACE: { base: '#dedcd6', detail: '#b6b4ae', kind: 'marble', rough: 0.6 },
  MAT_STEEL: { base: '#79808a', detail: '#99a1ac', kind: 'brushed', rough: 0.5 },
  MAT_PAINTED_STEEL_ORANGE: { base: '#d4701f', detail: '#a9530f', kind: 'paint', rough: 0.55 },
  MAT_PAINTED_STEEL_COBALT: { base: '#2170ce', detail: '#17529b', kind: 'paint', rough: 0.55 },
  MAT_PAINTED_STEEL_NAVY: { base: '#2c4262', detail: '#1b2c44', kind: 'paint', rough: 0.58 },
  MAT_PAINTED_STEEL_SUPPORT_YELLOW: { base: '#d8a527', detail: '#a87d14', kind: 'paint', rough: 0.55 },
  MAT_RUBBER: { base: '#3a373c', detail: '#2a282c', kind: 'speckle', rough: 0.98 },
};

/**
 * Metalness is zero for every material, including the ones called steel.
 *
 * This is deliberate and it is the fix for a real defect. three.js shades a metallic
 * surface almost entirely from reflected environment light, so a MeshStandardMaterial
 * with metalness above zero and no environment map in the scene renders black. The
 * steel columns did exactly that: solid black cylinders. The scene is stylised and flat
 * lit with no environment map by design, so metal is conveyed by colour and by a
 * brushed texture rather than by reflectance.
 */
const METALNESS = 0;

/** Fallback for a material name the art adds later without telling this file. */
const FALLBACK = { base: '#b9b6b0', detail: '#95928d', kind: 'speckle', rough: 0.85 };

/** @type {Map<string, MeshStandardMaterial>} */
const cache = new Map();

/**
 * Deterministic pseudo random number generator.
 *
 * Textures are generated with this rather than Math.random so a given material looks
 * identical on every load and between machines. A texture that changes between runs
 * makes screenshot comparison worthless.
 *
 * @param {number} seed
 * @returns {() => number} Values in [0, 1).
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns a material name into a stable seed, so each material looks different. */
function seedFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Draws one material's texture onto a canvas.
 *
 * Assumes a browser or any environment with a 2D canvas. Returns the canvas, ready to
 * become a CanvasTexture.
 *
 * @param {string} name
 * @param {typeof FALLBACK} spec
 * @returns {HTMLCanvasElement}
 */
function drawTexture(name, spec) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(seedFor(name));

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, TEX, TEX);

  switch (spec.kind) {
    case 'woodGrain': {
      // Long wavy lines along one axis, which is what reads as planking at a glance.
      ctx.strokeStyle = spec.detail;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 46; i += 1) {
        const y = rnd() * TEX;
        ctx.globalAlpha = 0.1 + rnd() * 0.3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= TEX; x += 16) {
          ctx.lineTo(x, y + Math.sin((x / TEX) * Math.PI * (1 + rnd() * 3)) * (2 + rnd() * 5));
        }
        ctx.stroke();
      }
      break;
    }
    case 'woodRings': {
      // Concentric arcs, the cut end of a log.
      ctx.strokeStyle = spec.detail;
      const cx = TEX * (0.35 + rnd() * 0.3);
      const cy = TEX * (0.35 + rnd() * 0.3);
      for (let r = 4; r < TEX * 1.3; r += 5 + rnd() * 6) {
        ctx.globalAlpha = 0.16 + rnd() * 0.3;
        ctx.lineWidth = 1 + rnd() * 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'brick': {
      // Courses of brick with the mortar drawn as the detail colour, offset every row.
      const rows = 8;
      const cols = 4;
      const h = TEX / rows;
      const w = TEX / cols;
      ctx.fillStyle = spec.detail;
      ctx.globalAlpha = 0.85;
      // Mortar is kept thin. Wide mortar averages with the brick under mipmapping and
      // turns a red wall pink at the distance the blocks are actually seen from.
      const mortar = 2;
      for (let r = 0; r < rows; r += 1) {
        ctx.fillRect(0, r * h - mortar / 2, TEX, mortar);
        const offset = (r % 2) * (w / 2);
        for (let c = 0; c <= cols; c += 1) {
          ctx.fillRect(c * w + offset - mortar / 2, r * h, mortar, h);
        }
      }
      break;
    }
    case 'marble': {
      // Soft veining. Low contrast, because the preview shows pale marble rather than
      // heavily figured stone.
      ctx.strokeStyle = spec.detail;
      for (let i = 0; i < 26; i += 1) {
        ctx.globalAlpha = 0.06 + rnd() * 0.16;
        ctx.lineWidth = 2 + rnd() * 9;
        ctx.beginPath();
        let x = rnd() * TEX;
        let y = -10;
        ctx.moveTo(x, y);
        while (y < TEX + 10) {
          x += (rnd() - 0.5) * 34;
          y += 14 + rnd() * 20;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'brushed': {
      // Fine horizontal streaks, which reads as machined metal without a normal map.
      for (let i = 0; i < 420; i += 1) {
        ctx.globalAlpha = 0.03 + rnd() * 0.12;
        ctx.fillStyle = rnd() > 0.5 ? spec.detail : '#000000';
        const y = rnd() * TEX;
        ctx.fillRect(rnd() * TEX, y, 20 + rnd() * 90, 1);
      }
      break;
    }
    case 'paint': {
      // Painted steel is nearly flat. Only a faint mottle, so large painted areas do
      // not band on a phone's 8 bit display.
      for (let i = 0; i < 900; i += 1) {
        ctx.globalAlpha = 0.02 + rnd() * 0.05;
        ctx.fillStyle = rnd() > 0.5 ? spec.detail : '#ffffff';
        ctx.fillRect(rnd() * TEX, rnd() * TEX, 2 + rnd() * 5, 2 + rnd() * 5);
      }
      break;
    }
    case 'speckle':
    default: {
      for (let i = 0; i < 2600; i += 1) {
        ctx.globalAlpha = 0.05 + rnd() * 0.22;
        ctx.fillStyle = rnd() > 0.45 ? spec.detail : '#ffffff';
        const s = 1 + rnd() * 2.6;
        ctx.fillRect(rnd() * TEX, rnd() * TEX, s, s);
      }
      break;
    }
  }

  ctx.globalAlpha = 1;
  return canvas;
}

/**
 * Returns the material for one authored material name, building it on first use.
 *
 * Assumes a document is available, so this must not be called from the Node test
 * runner. Materials are shared across every piece that uses the name, which is what
 * keeps a level of forty pieces down to a handful of materials.
 *
 * An unknown name returns a neutral speckled material rather than throwing, because a
 * future art update adding a thirteenth material should look plain rather than crash
 * the game. Unknown names are reported by getUnknownMaterialNames().
 *
 * @param {string} name
 * @returns {MeshStandardMaterial}
 */
export function materialFor(name) {
  const cached = cache.get(name);
  if (cached) return cached;

  const spec = PALETTE[name] ?? FALLBACK;
  if (!PALETTE[name]) unknownNames.add(name);

  const texture = new CanvasTexture(drawTexture(name, spec));
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;

  const material = new MeshStandardMaterial({
    name,
    map: texture,
    roughness: spec.rough ?? 0.85,
    metalness: METALNESS,
  });
  cache.set(name, material);
  return material;
}

const unknownNames = new Set();

/** Material names the art used that this file has no palette entry for. */
export function getUnknownMaterialNames() {
  return [...unknownNames];
}

/** Every material name this file knows how to draw. Used by the tests. */
export const KNOWN_MATERIAL_NAMES = Object.keys(PALETTE);

/** Releases every generated texture. Called only when the game shuts down. */
export function disposeMaterials() {
  for (const m of cache.values()) {
    m.map?.dispose();
    m.dispose();
  }
  cache.clear();
}
