/**
 * convert-blocks.mjs
 *
 * OWNS: the one and only conversion from the authored FBX block kit to the .glb files
 * the game loads at runtime, and the conformance check that conversion did not shift a
 * dimension or a pivot.
 *
 * MUST NOT OWN: physics values, material families, collider shapes or anything about
 * how a piece behaves. Those live in src/blocks/. This script is about geometry and
 * nothing else. It never modifies a file under Assets/; the FBX originals are inputs.
 *
 * Run with: npm run convert:blocks
 *
 * Why this exists as a script rather than a one time manual export: an art update has
 * to be one command, and a conversion that silently shifts a pivot turns every level
 * into a leaning tower. This script fails loudly instead.
 *
 * Sources consulted while writing this, rather than recalled: three.js FBXLoader,
 * GLTFExporter and BufferGeometryUtils, read from the installed package under
 * node_modules/three/examples/jsm/ at three 0.185.1.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeGroups } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The authored FBX files are in centimetres: a 1 SU cube measures 100 units on a side,
 * measured by loading B01_SMALL_BLOCK_WOOD_V2.fbx and reading its bounding box.
 * 1 Structural Unit = 1 metre, per Assets/Art/Blocks/README.md, so geometry is scaled
 * by this factor at conversion time and the .glb files are in SU. Nothing downstream
 * needs to know about centimetres.
 */
const FBX_UNITS_PER_SU = 100;

/**
 * Tolerance in SU when comparing a converted bounding box against the manifest.
 * Set at 1 mm. The FBX values are not exactly integral (a 3 SU beam measures
 * 300.000016 FBX units) because the authoring package wrote floats, so an exact
 * comparison would fail on every curved piece. 1 mm is far tighter than any error that
 * could be seen in game and far looser than the observed float noise.
 */
const DIMENSION_TOLERANCE_SU = 0.001;

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const BLOCKS_DIR = path.join(REPO_ROOT, 'Assets', 'Art', 'Blocks');
const MANIFEST_PATH = path.join(BLOCKS_DIR, 'block_asset_manifest.json');
const VARIANT_MANIFEST_PATH = path.join(
  BLOCKS_DIR, 'MaterialVariants', 'V2', 'material_variant_manifest_v2.json',
);
const OUTPUT_DIR = path.join(REPO_ROOT, 'public', 'models', 'blocks');
const REPORT_PATH = path.join(OUTPUT_DIR, 'conversion-report.json');

// ---------------------------------------------------------------------------
// Node environment shims
// ---------------------------------------------------------------------------

/**
 * Installs a minimal FileReader on globalThis if one is missing.
 *
 * GLTFExporter assembles its binary output through a Blob and reads it back with a
 * FileReader. Node 24 has Blob but no global FileReader, so exporting throws
 * "FileReader is not defined" without this. Only the two read methods the exporter
 * actually calls are implemented.
 *
 * Must be called before GLTFExporter is imported, which is why that import is dynamic.
 */
function installFileReaderShim() {
  if (typeof globalThis.FileReader !== 'undefined') return;
  globalThis.FileReader = class FileReaderShim {
    constructor() {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    }

    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(
        (ab) => { this.result = ab; this.onloadend?.(); },
        (err) => this.onerror?.(err),
      );
    }

    readAsDataURL(blob) {
      blob.arrayBuffer().then(
        (ab) => {
          const type = blob.type || 'application/octet-stream';
          this.result = `data:${type};base64,${Buffer.from(ab).toString('base64')}`;
          this.onloadend?.();
        },
        (err) => this.onerror?.(err),
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Converts all fifteen pieces and writes a conversion report.
 *
 * Assumes the FBX kit is present under Assets/Art/Blocks. Returns the report object.
 * Throws if a manifest is missing. Does not throw on a per piece conformance failure;
 * failures are collected into the report and turned into a non-zero exit code by the
 * caller, so that one bad piece still produces a full report of the other fourteen.
 */
async function convertAll() {
  installFileReaderShim();
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

  const manifest = readJson(MANIFEST_PATH);
  const variants = readJson(VARIANT_MANIFEST_PATH);
  const variantById = new Map(variants.variants.map((v) => [v.geometry_id, v]));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const exporter = new GLTFExporter();
  const pieces = [];

  for (const piece of manifest.pieces) {
    const variant = variantById.get(piece.id);
    if (!variant) {
      pieces.push({
        id: piece.id, ok: false, errors: ['no V2 variant in the variant manifest'],
      });
      continue;
    }
    // Sequential on purpose. GLTFExporter keeps internal per-parse state and the whole
    // run takes a couple of seconds, so there is nothing to gain from overlapping them.
    // eslint-disable-next-line no-await-in-loop
    pieces.push(await convertPiece(piece, variant, exporter));
  }

  const report = {
    generatedBy: 'scripts/convert-blocks.mjs',
    generatedAt: new Date().toISOString(),
    threeVersion: THREE.REVISION,
    sourceKit: 'Assets/Art/Blocks/MaterialVariants/V2 (V2 materialized variants)',
    fbxUnitsPerStructuralUnit: FBX_UNITS_PER_SU,
    dimensionToleranceSU: DIMENSION_TOLERANCE_SU,
    pieceCount: pieces.length,
    passCount: pieces.filter((p) => p.ok).length,
    failCount: pieces.filter((p) => !p.ok).length,
    pieces,
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Converts one piece and measures the result.
 *
 * Assumes `piece` comes from block_asset_manifest.json and `variant` from the V2
 * variant manifest. Returns a per piece report row including measured size, measured
 * pivot offset, triangle count, draw call count and any conformance errors. Writes the
 * .glb as a side effect.
 */
async function convertPiece(piece, variant, exporter) {
  const errors = [];
  const fbxPath = path.join(BLOCKS_DIR, variant.model_filename);
  const buf = fs.readFileSync(fbxPath);
  const root = new FBXLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '',
  );

  // Scale centimetres to Structural Units. updateMatrixWorld bakes it through the
  // hierarchy so the exported file carries no transform the runtime has to remember.
  root.scale.setScalar(1 / FBX_UNITS_PER_SU);
  root.updateMatrixWorld(true);

  const materialNames = new Set();
  let triangles = 0;
  let drawCalls = 0;
  let groupsBefore = 0;

  root.traverse((o) => {
    if (!o.isMesh) return;
    const geom = o.geometry;
    groupsBefore += geom.groups?.length ?? 0;

    // The authored meshes assign materials face by face, which leaves as many as 261
    // separate geometry groups on a single column. Every group becomes its own glTF
    // primitive and therefore its own draw call. mergeGroups sorts the index buffer by
    // material and collapses the groups to one per material, which is the difference
    // between 261 draw calls per column and 2.
    if (geom.groups && geom.groups.length > 1) mergeGroups(geom);

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const converted = mats.map((m) => toStandardMaterial(m, materialNames));
    o.material = converted.length === 1 ? converted[0] : converted;

    triangles += (geom.index ? geom.index.count : geom.attributes.position.count) / 3;
    drawCalls += Math.max(1, geom.groups?.length ?? 1);
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  // Conformance against the manifest, which is the authority on both numbers.
  checkDimension(errors, 'width', size.x, piece.width);
  checkDimension(errors, 'height', size.y, piece.height);
  checkDimension(errors, 'depth', size.z, piece.depth);

  // Pivot. center-bottom means the origin sits on the base, so the box runs from y=0
  // upward. geometric-center means the origin is at the middle of the bounding box.
  const expectedMinY = piece.pivot === 'geometric-center' ? -piece.height / 2 : 0;
  if (Math.abs(box.min.y - expectedMinY) > DIMENSION_TOLERANCE_SU) {
    errors.push(
      `pivot ${piece.pivot}: expected bounding box min y of ${expectedMinY.toFixed(3)} SU, `
      + `measured ${box.min.y.toFixed(6)} SU`,
    );
  }
  // Both pivot kinds are centred on X and Z.
  for (const axis of ['x', 'z']) {
    const centre = (box.min[axis] + box.max[axis]) / 2;
    if (Math.abs(centre) > DIMENSION_TOLERANCE_SU) {
      errors.push(`pivot: ${axis} centre is ${centre.toFixed(6)} SU, expected 0`);
    }
  }

  const glb = await exporter.parseAsync(root, { binary: true });
  const outPath = path.join(OUTPUT_DIR, `${piece.id}.glb`);
  fs.writeFileSync(outPath, Buffer.from(glb));

  return {
    id: piece.id,
    ok: errors.length === 0,
    sourceFbx: variant.model_filename,
    outputGlb: path.relative(REPO_ROOT, outPath).replace(/\\/g, '/'),
    bytes: glb.byteLength,
    pivot: piece.pivot,
    expected: { width: piece.width, height: piece.height, depth: piece.depth },
    measured: {
      width: round6(size.x),
      height: round6(size.y),
      depth: round6(size.z),
      minY: round6(box.min.y),
      maxY: round6(box.max.y),
    },
    triangles,
    drawCalls,
    drawCallsBeforeMerge: Math.max(1, groupsBefore),
    materials: [...materialNames],
    errors,
  };
}

function checkDimension(errors, label, measured, expected) {
  if (Math.abs(measured - expected) > DIMENSION_TOLERANCE_SU) {
    errors.push(`${label}: expected ${expected} SU, measured ${measured.toFixed(6)} SU`);
  }
}

/**
 * Converts an FBX material to MeshStandardMaterial, which is the physically based
 * model glTF stores natively.
 *
 * FBXLoader produces MeshPhongMaterial, which the exporter can only approximate and
 * warns about. Colour and name carry over unchanged, so the approved V2 art direction
 * survives the conversion. Records the material name in `nameSink` for the report.
 */
function toStandardMaterial(material, nameSink) {
  if (!material) return material;
  nameSink.add(material.name || '(unnamed)');
  if (material.isMeshStandardMaterial) return material;
  return new THREE.MeshStandardMaterial({
    name: material.name,
    color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
    // The kit is stylised and flat lit. High roughness with no metalness keeps every
    // family reading as its own colour rather than mirroring the sky. The per family
    // look is carried by colour, not by reflectance.
    roughness: 0.85,
    metalness: 0.0,
    map: material.map ?? null,
    flatShading: false,
  });
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

const report = await convertAll();
for (const p of report.pieces) {
  const status = p.ok ? 'ok  ' : 'FAIL';
  const m = p.measured;
  const dims = m ? `${m.width} x ${m.height} x ${m.depth} SU` : '(not measured)';
  console.log(
    `${status} ${p.id.padEnd(26)} ${dims.padEnd(24)} `
    + `tris=${String(p.triangles).padStart(5)} draws=${p.drawCalls} (was ${p.drawCallsBeforeMerge})`,
  );
  for (const e of p.errors) console.log(`       ${e}`);
}
console.log(
  `\n${report.passCount}/${report.pieceCount} pieces conform to the manifest. `
  + `Report: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`,
);
process.exit(report.failCount === 0 ? 0 : 1);
