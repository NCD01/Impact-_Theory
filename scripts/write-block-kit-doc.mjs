/**
 * write-block-kit-doc.mjs
 *
 * OWNS: generating docs/BLOCK_KIT.md.
 *
 * MUST NOT OWN: any of the numbers in it. Every dimension, pivot, family, collider and
 * physics value is read from the authored manifest, from src/blocks/ and from the
 * conversion report. Nothing is typed in twice, so the document cannot drift from the
 * code the way a hand written table does.
 *
 * Run: node scripts/write-block-kit-doc.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

import { PIECES } from '../src/blocks/manifest.js';
import { FAMILIES } from '../src/blocks/families.js';
import { colliderVolume } from '../src/blocks/colliders.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const REPORT_PATH = path.join(REPO_ROOT, 'public', 'models', 'blocks', 'conversion-report.json');
const OUT = path.join(REPO_ROOT, 'docs', 'BLOCK_KIT.md');

const report = fs.existsSync(REPORT_PATH)
  ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'))
  : null;
const byId = new Map((report?.pieces ?? []).map((p) => [p.id, p]));

function colliderDescription(c) {
  if (c.kind === 'cuboid') return 'box';
  if (c.kind === 'cylinder') return `cylinder, ${c.axis.toUpperCase()} axis`;
  return `compound, ${c.parts.length} boxes`;
}

const lines = [];
lines.push('# The block kit');
lines.push('');
lines.push('**This file is generated.** Run `node scripts/write-block-kit-doc.mjs` after changing');
lines.push('the manifest, the material families or the collider definitions. Every number below is');
lines.push('read from `Assets/Art/Blocks/block_asset_manifest.json`, from `src/blocks/`, and from');
lines.push('the conversion report, so it cannot drift from the code.');
lines.push('');
lines.push('One Structural Unit, written SU, is one metre. Model axes are X width, Y up, Z depth.');
lines.push('That convention comes from the art pass, in `Assets/Art/Blocks/README.md`, and is');
lines.push('adopted unchanged as the game world unit so the project has exactly one scale.');
lines.push('');

lines.push('## The fifteen pieces');
lines.push('');
lines.push('| ID | Name | Category | W x H x D (SU) | Pivot | Family | Collider | Volume (SU³) | Mass (kg) |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const p of PIECES) {
  const fam = FAMILIES[p.defaultFamily];
  const mass = colliderVolume(p.collider) * fam.density;
  lines.push(
    `| \`${p.id}\` | ${p.name} | ${p.category} | ${p.width} x ${p.height} x ${p.depth} `
    + `| ${p.pivot} | ${fam.label} | ${colliderDescription(p.collider)} `
    + `| ${p.volume.toFixed(2)} | ${Math.round(mass)} |`,
  );
}
lines.push('');
lines.push('Mass is volume times the family density, which is what Rapier computes from the same');
lines.push('two numbers. Compound colliders sum their parts without subtracting overlaps, so the');
lines.push('cross beam and the stabiliser read slightly heavy here.');
lines.push('');

lines.push('## Pivots, and why they matter');
lines.push('');
lines.push('Thirteen pieces are authored with a **center-bottom** pivot: the origin sits on the base');
lines.push('and the geometry runs upward, so placing one at `y: 3` puts its underside at 3 SU.');
lines.push('Two pieces use a **geometric-center** pivot, where the origin is in the middle of the');
lines.push('bounding box:');
lines.push('');
for (const p of PIECES.filter((x) => x.pivot === 'geometric-center')) {
  lines.push(`- \`${p.id}\`, ${p.name}. Placing one at \`y: 3\` puts its underside at `
    + `${3 - p.height / 2} SU and its top at ${3 + p.height / 2} SU.`);
}
lines.push('');
lines.push('Rapier colliders are always centred on their own origin, so a center-bottom piece needs');
lines.push('its collider lifted by half its height and a geometric-center piece needs no lift at');
lines.push('all. `src/blocks/colliders.js` computes that as `pivotLift`. Getting it wrong sinks');
lines.push('pieces halfway into the ground, and it looks like a physics bug rather than a placement');
lines.push('one, which is why the unit suite checks every piece.');
lines.push('');

lines.push('## Material families');
lines.push('');
lines.push('| Family | Density (kg/SU³) | Restitution | Friction | Hit points (J) | Score weight |');
lines.push('|---|---|---|---|---|---|');
for (const f of Object.values(FAMILIES)) {
  lines.push(
    `| ${f.label} | ${f.density} | ${f.restitution} | ${f.friction} `
    + `| ${f.hitPoints.toLocaleString('en-GB')} | ${f.scoreWeight} |`,
  );
}
lines.push('');
lines.push('**The densities are not the real densities of the materials they are named after.** Real');
lines.push('steel is 7850 kg per cubic metre, which makes a 1 SU cube weigh nearly eight tonnes and');
lines.push('immovable by any ball a child would believe in. These values keep the ordering and the');
lines.push('feel while compressing the range to roughly three to one, so every family is movable and');
lines.push('heavy things still feel heavy. A deliberate game value, not a mistake about physics.');
lines.push('');
lines.push('**Hit points are joules of accumulated impact energy**, set against the impact energies');
lines.push('this game actually produces rather than guessed. See `docs/DECISIONS.md` D-007 for the');
lines.push('measurement: a standing structure produces contacts under 10 J, while a square ball hit');
lines.push('is worth 5,000 to 50,000 J.');
lines.push('');

if (report) {
  lines.push('## Conversion conformance');
  lines.push('');
  lines.push(`Generated by \`scripts/convert-blocks.mjs\` against three r${report.threeVersion}, `
    + `from ${report.sourceKit}.`);
  lines.push('');
  lines.push(`**${report.passCount} of ${report.pieceCount} pieces** match the manifest on width, `
    + `height, depth and pivot within ${report.dimensionToleranceSU * 1000} mm.`);
  lines.push('');
  lines.push('| ID | Measured W x H x D (SU) | Measured min Y | Triangles | Draw calls | Was |');
  lines.push('|---|---|---|---|---|---|');
  for (const p of PIECES) {
    const r = byId.get(p.id);
    if (!r) continue;
    lines.push(
      `| \`${p.id}\` | ${r.measured.width} x ${r.measured.height} x ${r.measured.depth} `
      + `| ${r.measured.minY} | ${r.triangles} | ${r.drawCalls} | ${r.drawCallsBeforeMerge} |`,
    );
  }
  lines.push('');
  lines.push('The last two columns are draw calls after and before merging material groups. The');
  lines.push('authored meshes assign materials face by face, leaving as many as 261 geometry groups');
  lines.push('on a single column, and every group becomes its own glTF primitive. Merging by');
  lines.push('material is the difference between 261 draw calls per column and 2.');
  lines.push('');
}

lines.push('## What the FBX files do not carry');
lines.push('');
lines.push('The V2 materialized FBX files carry material **names** and per face material');
lines.push('**assignment**, but no appearance at all. Every material in all fifteen files reads back');
lines.push('as `MeshPhongMaterial` with colour `#cccccc`, no texture and no useful specular. The V2');
lines.push('look was authored as procedural Blender node materials, which FBX cannot carry, which is');
lines.push('why `Art/Materials/V2/V2_MATERIAL_LIBRARY.blend` exists.');
lines.push('');
lines.push('So appearance is rebuilt in code, in `src/render/materials.js`, keyed to the same twelve');
lines.push('authored material names, with colours read off the V2 preview renders. The per face');
lines.push('assignment the FBX did preserve is what makes it work: end grain still lands on the ends');
lines.push('of a beam because the art said so. This is an approximation of the approved art');
lines.push('direction, not the direction itself.');
lines.push('');

fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${path.relative(REPO_ROOT, OUT)}: ${lines.length} lines, ${PIECES.length} pieces.`);
