# Changelog

Newest entry first. The version scheme is defined in `docs/VERSIONING.md`.

Every entry carries a Validation Evidence line stating what was actually run or
looked at. A claim with no evidence line behind it is not a claim this project makes.

## v1.5.0+8 - 2026-08-30 - Feature

**Author:** Claude Opus 5, unattended build session
**Reason:** The game needs the block kit as data before it can place a single piece:
dimensions, pivots, material families and collider shapes, all traceable to the
authored manifest rather than restated from memory.

**Changes:**
- `src/core/constants.js`. Every tuning value in one file, each with its units, its
  reason and where the number came from.
- `src/core/projection.js`. The single screen to world helper standard 4 requires.
  Pointer to normalised coordinates, pointer to world ray, pointer to ground point,
  world to screen for the interface, and viewport metrics, all recalculated on resize.
- `src/core/version.js`, holding the version string the running game reports.
- `src/blocks/families.js`. The seven physics material families with density,
  restitution, friction, hit points and score weight, plus each piece's default family
  taken from the approved V2 art direction.
- `src/blocks/colliders.js`. Collider shapes derived from manifest dimensions, never
  from the mesh, with the pivot lift that reconciles center-bottom authoring against
  Rapier's centred colliders.
- `src/blocks/manifest.js`. Reads the authored manifest and joins each piece to its
  family and collider.
- `vite.config.js` and `eslint.config.js`.
- `tests/unit/block-manifest.test.js`, 34 tests.

**On the density values:** they are not the real densities of the named materials. Real
steel is 7850 kg per cubic metre, which makes a 1 SU cube weigh nearly eight tonnes and
immovable by any ball a child would believe in. The values keep the ordering and
compress the range to roughly three to one. That is a deliberate game value and the
reason is recorded in the file.

**Validation Evidence:** `npx vitest run` reported 34 of 34 passing. The suite restates
the manifest's dimension table independently and checks all fifteen pieces against it,
checks both geometric-center pivots resolve to zero lift and the thirteen center-bottom
pivots to half height, checks the arch collider encloses less volume than its bounding
box so the opening survives, and checks every converted `.glb` exists on disk with the
measured dimensions and pivots from the conversion report. `npx eslint .` exited 0 with
no errors and no warnings.

## v1.4.0+7 - 2026-08-30 - Feature

**Author:** Claude Opus 5, unattended build session
**Reason:** The game renders glTF, the art is authored as FBX, and an art update has to
be one command rather than an afternoon. A conversion that silently shifts a pivot
would turn every level into a leaning tower, so the conversion checks itself.

**Changes:**
- `scripts/convert-blocks.mjs`. Loads each of the fifteen V2 materialized FBX files,
  scales centimetres to Structural Units, merges per face material groups, converts
  Phong materials to MeshStandard, exports `.glb`, and measures the result against
  `block_asset_manifest.json`. Exits non-zero if any piece fails.
- Writes `public/models/blocks/conversion-report.json` with per piece measured size,
  pivot offset, triangle count, draw calls before and after merging, and materials.
- `public/models/` added to `.gitignore`, because it is generated. `predev`,
  `prebuild` and `pretest` run the conversion, so no command can run against stale
  models and the deploy workflow regenerates them from the FBX originals.

**Two findings worth recording:**
- The FBX kit is authored in centimetres. A 1 SU cube measures 100 FBX units. The
  scale factor is applied at conversion, so every `.glb` is in Structural Units and no
  runtime code needs to know about centimetres.
- The authored meshes assign materials face by face. `S01_ROUND_COLUMN` and
  `A04_ROLLER` carry 261 geometry groups each, and every group becomes its own glTF
  primitive and its own draw call. Merging groups by material brings the worst piece
  down from 261 draw calls to 2.

**Validation Evidence:** `node scripts/convert-blocks.mjs` reported 15 of 15 pieces
conforming. Every measured width, height and depth matched the manifest within the
1 mm tolerance, and both geometric-center pivots (`A03_CROSS_BEAM` at min y -1.5 SU
and `A04_ROLLER` at min y -0.5 SU) measured where the manifest says they should be,
as did the thirteen center-bottom pivots at min y 0. Triangle counts run from 80 on
`S04_WEDGE` to 3028 on `A05_MECHANICAL_STABILIZER`. Draw calls after merging are 1 to
5 per piece. A round trip through GLTFLoader was checked separately on
`A03_CROSS_BEAM` and returned the same bounding box the FBX had.

## v1.3.0+6 - 2026-08-30 - Documentation

**Author:** Claude Opus 5, unattended build session
**Reason:** Decisions taken alone in an unattended session are worthless to the owner
unless they are written down with their alternatives and their rollback cost. Phase 0
also produced three findings that contradict the build brief, and those need to be on
record before any later phase relies on the brief's version.

**Changes:**
- `docs/DECISIONS.md` with D-001 through D-005.
- `docs/PROGRESS.md` with a row for all sixteen phases and the phase 0 findings.
- `package.json` at version `1.0.0+1` pinning three, Rapier, Vite, Vitest, Playwright
  and ESLint to the versions currently published on the npm registry.

**The three findings, in short:**
1. The folder the brief calls `Games\Impact` is actually `Games\IT`.
2. The V2 materialized block library is already under version control and already on
   GitHub in that project. The brief's claim that two commit messages are false is
   itself incorrect.
3. That project's working tree carries 162 uncommitted staged deletions, which is why
   its `git ls-files` appears to show the library missing.

**Validation Evidence:** Versions read from the npm registry with `npm view <pkg>
version` rather than from memory: three 0.185.1, @dimforge/rapier3d-compat 0.20.0,
vite 8.2.2, vitest 4.1.11, @playwright/test 1.62.1, eslint 10.9.1. Finding 2 verified
with `git ls-tree -r origin/main --name-only` in `Games\IT`, which returned 18 paths
under `Assets/Art/Blocks/MaterialVariants`. Finding 3 verified with
`git status --short` there, which returned 162 lines beginning with `D `. Only read
only git commands were run in that repository and no fetch was performed, because a
fetch writes to `.git`.

## v1.2.2+5 - 2026-08-30 - Structural

**Author:** Claude Opus 5, unattended build session
**Reason:** This build starts over in Three.js and keeps the art. The Unity project
files needed to move out of the way of the new source tree without being deleted and
without losing their history.

**Changes:**
- Moved into `_source/unity-checkpoint/Assets/` with `git mv`: `Scripts`, `Tests`,
  `Scenes`, `WebGLTemplates`, `Resources`, `Generated`, `Materials`, `Physics`, and
  every `.meta` and `.asmdef` file that was under `Assets`.
- Left `Assets/Art`, `Assets/Audio`, `Assets/Data` and `Assets/Reference` in place as
  this build's asset home.
- Added `docs/ARCHIVE.md` recording what is in the checkpoint, where the same C# lives
  under version control, and the exact commands to move it back.

**Note:** `Generated`, `Materials` and `Physics` were not named in the brief. Each held
nothing but a `.gitkeep` and each is a Unity folder convention with no meaning to a
Three.js build, so they moved with the rest. `Resources` moved because Unity treats
that folder name specially and its contents are two ShaderLab shaders and two PNGs
belonging to a different project of the owner's.

**Validation Evidence:** `git status --short` reports 337 entries beginning with `R`,
so git recorded every one of them as a rename and history follows the files. Asset
counts under `Assets` after the move: 30 FBX, 73 PNG, 5 blend, 2 blend1, 8 JSON, 1 CSV,
3 Markdown. The PNG count fell from 75 to 73 because the two background images that
belong to another project moved into the checkpoint. Checkpoint contents counted at 61
C#, 257 meta, 9 asmdef, 1 Unity scene, 2 shaders. Nothing was deleted.

## v1.2.1+4 - 2026-08-30 - Structural

**Author:** Claude Opus 5, unattended build session
**Reason:** Resolves a direct conflict between two instructions in the build brief.
The workspace section required the `Assets\` tree to be committed verbatim with
nothing filtered out. The git section required `.gitignore` to exclude OS junk
including `Thumbs.db` before the first commit, and stated that nothing generated is
ever tracked. Both could not hold at once for two files.

**Resolution:** The backup instruction was honoured first, so the verbatim commit
`9f848f2` contains both `Thumbs.db` files and they are recoverable from history
forever. This commit then satisfies the standard by removing them from tracking. No
file was silently dropped at any point, which was the concern behind the verbatim
instruction.

**Changes:**
- Added `Thumbs.db` to `.gitignore`.
- `git rm --cached` on both `Thumbs.db` files and on the two `Thumbs.db.meta`
  sidecars Unity generated alongside them. All four remain on disk.

**Validation Evidence:** `git ls-files | grep -c Thumbs` returned 4 before and 0
after. The count is 4 rather than 2 because Unity wrote a `.meta` sidecar for each
cache file, and those two sidecars are untracked here as well since their target is no
longer tracked. `git ls-tree -r 9f848f2 --name-only | grep -c Thumbs` returned 4,
confirming all four are still retrievable from the backup commit. All four files
confirmed still present on disk with `find`.

## v1.2.0+3 - 2026-08-30 - Asset

**Author:** Claude Opus 5, unattended build session
**Reason:** The reference material describes the target this game is modelled on. It
sits outside `Assets\` so it was not part of the asset backup commit, and it needs its
own place in history.

**Changes:**
- Committed `Reference\`: the 4.6 second reference clip as H.264 at 540 px wide, the
  original HEVC phone recording at 1320 x 2868, nine stills pulled at 2 fps, the
  reference README, and the build brief this session is working from.

**Note on rights:** The clip is another studio's commercial game. It is reference, not
a licence. No name, art, sound, icon, interface text or level layout from it appears in
this project. See standard 9 in the build brief and `docs/DECISIONS.md` decision D-003.

**Validation Evidence:** Read `Reference/README.md` and opened `frames/frame_01.jpg`
and `frames/frame_05.jpg` directly. Frame 1 shows a wooden structure on one central
pedestal, frame 5 a dark stone structure on two pedestals mid collapse with visible
rubble fragments, which matches the description in the brief. No interface elements
appear in either frame. File sizes confirmed with `find -printf`.

## v1.1.0+2 - 2026-08-30 - Asset

**Author:** Claude Opus 5, unattended build session
**Reason:** The existing `Assets\` tree, including the V2 materialized block library,
sat on a single network share with no version control of its own in this location.
This commit places the whole tree on a remote before any other work begins, so that a
disk failure stops being able to end the project.

**Changes:**
- Committed the entire existing `Assets\` tree verbatim. Nothing was cleaned,
  filtered, reorganised or renamed first, including the two Windows `Thumbs.db`
  thumbnail caches, which are removed from tracking in the next commit and remain
  recoverable from this one.
- Content: 15 V1 structural FBX models, 15 V2 materialized FBX variants, 40 V2 and
  V1 transparent PNG previews, the reproducible Blender sources, the V2 material
  library, `block_asset_manifest.json` and `.csv`, `validation_report.json`,
  `material_variant_manifest_v2.json` and `validation_report_v2.json`, plus the
  Unity checkpoint code that is moved aside in a later commit.

**Validation Evidence:** File and byte counts taken with `find` before staging and
compared against `git ls-files` after committing, both reported in the commit body.
`find . -type f -size +50M` returned zero files, so no Git LFS pointer was needed and
nothing was excluded for size. The push was confirmed by fetching from the remote and
running `git diff --stat HEAD origin/main`, which reported no difference.

## v1.0.0+1 - 2026-08-30 - Structural

**Author:** Claude Opus 5, unattended build session
**Reason:** The master folder held a finished art tree and no version control of its
own. Nothing could be committed safely until line ending handling and ignore rules
were in place, because the global git configuration on this machine sets
`core.autocrlf=true`, which rewrites line endings in any file git guesses is text.

**Changes:**
- `git init` on `H:\Marcelo\Programming\Games\Impact Theory`, branch `main`.
- Remote `origin` set to `https://github.com/NCD01/Impact-_Theory.git`, the underscore
  form. The similarly named repository without the underscore belongs to a different
  live project and must never receive a push from here.
- `.gitattributes` declaring every binary format used by this project explicitly,
  so that FBX, Blender, PNG and video files cannot be corrupted by end of line
  conversion.
- `.gitignore` covering dependencies, build output, `.agent_temp/`, test output,
  logs, editor folders and OS junk.
- `docs/VERSIONING.md`, the single authority on the version scheme.
- This changelog.

**Validation Evidence:** `git remote -v` run in the repository root and confirmed to
return the underscore URL for both fetch and push. `git ls-remote` against that URL
returned exit status 0 with an empty ref list, confirming the remote exists and is
empty. `git config --get core.autocrlf` returned `true`, which is the reason the
attributes file was written before any file was staged. No file in the tree exceeds
50 MB, measured with `find . -type f -size +50M`, so Git LFS is not required.
