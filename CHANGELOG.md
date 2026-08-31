# Changelog

Newest entry first. The version scheme is defined in `docs/VERSIONING.md`.

Every entry carries a Validation Evidence line stating what was actually run or
looked at. A claim with no evidence line behind it is not a claim this project makes.

## v1.13.0+19 - 2026-08-31 - Fix

**Author:** Claude Opus 5, unattended build session
**Reason:** The owner played the build and reported five things. All five were right and
all five are fixed here.

**1. "there is a humming sound stop it".** The background pad is gone, not muted. A
sustained drone under a game built on percussive impacts fights the thing the player is
listening for, and on a replayed level it becomes noise. Removed rather than disabled, so
there is no dead code pretending to be a feature. Every impact, fracture and interface
sound is unchanged.

**2. "look at the org images its always on a platform that is missing".** He spotted this
in the first screenshot he looked at. A support check across the thirty levels found **26
pieces either floating in mid air or balanced on one edge of a pedestal**. The cause was an
authoring helper that placed two pedestals and left whatever sat above them to line up by
luck. Replaced by `platform()`, which lays a continuous deck and puts a pedestal under
every joint in it, including both ends, which is what the reference clip shows. All thirty
levels rebuilt on platforms. `scripts/verify-level-support.mjs` now reports zero, and the
same check runs in the unit suite so it cannot come back.

**3. "when you click play just start".** Play now opens the first level the player has not
cleared, rather than a menu. Level select moved to its own button on the title and is still
reachable from pause.

**4. "there is no instructions on how to play".** A how to play list on the title screen,
and a one line hint over the game the first time anyone opens a level, shown once ever and
pointer transparent so it cannot eat the touch it is asking for.

**5. "i should just point and it should move and if i drag right it goes left".** Both
correct, and the second was a real sign error. Aiming is now **absolute**: touch a spot and
the cannon aims there, with no memory of where it was. It also solves the launch angle so a
ball *lands* on the point rather than the barrel merely pointing at it, because at 27 SU/s
a shot across the playfield drops well over a metre. On a desktop the cannon follows the
mouse with no button held.

**Changes:** `src/input/controls.js` rewritten. `aimAt()` added to `src/game/cannon.js`.
`eventToDepthPlanePoint()` added to `src/core/projection.js`, so the new maths still lives
in the one projection helper. `scripts/author-levels.mjs` rewritten around `platform()`.
`scripts/verify-level-support.mjs` added. Music removed from `src/audio/audio.js`. Title,
hint and instructions in `src/ui/ui.js` and `index.html`. `seenHint` added to the save.
README, GAMEPLAY and ASSET_MANIFEST updated.

**Validation Evidence:** Played in a real browser at a 390 x 844 portrait viewport. Play
now lands in level 1 directly. Touching the far left of the screen gives a cannon yaw of
+0.252 rad and the far right gives -0.252 rad, which is the correct sign and confirms the
inversion is gone; the previous build gave the opposite. Ten shots cleared level 1 with no
console errors. `node scripts/verify-level-support.mjs` reports zero floating or teetering
pieces, down from 26. `npx vitest run` reports 178 of 178 passing, up from 147, including
31 new per level support tests. `npx eslint .` exits 0. The rebuilt level 1 was
photographed and shows two pedestals carrying a continuous deck with the crate on top.

## v1.12.2+18 - 2026-08-31 - Documentation

**Author:** Claude Opus 5, unattended build session
**Reason:** Phase 15, the closing report, plus two factual errors found in the README
during final verification.

**Changes:**
- `HANDOFF.md`, the report. Bottom line, how to run it, the asset backup with its hash and
  size, the body budget with its evidence and its caveat, all sixteen phases, every
  decision taken alone with its rollback cost, block kit conformance, a fidelity ledger
  against the reference clip, what is broken or missing ordered by consequence, every
  unverified value with the question that settles it, open questions, and the next three
  moves.
- `README.md` corrected: the test counts were stale at 139 and 10, now 147 and 12, and
  Rapier was described as MIT licensed when it is Apache 2.0. The asset manifest had it
  right; the README did not.

**The most important thing in the report:** the brief's central claim, that the V2
materialized block library exists nowhere under version control and that two of the
owner's commit messages are therefore false, is itself incorrect. `git ls-tree -r
origin/main` in the neighbouring project returns all 18 files under `MaterialVariants`.
What is actually wrong there is 162 uncommitted staged deletions in its working tree,
which is a live hazard the owner may not know about and which no one should act on without
checking whether the deletions were deliberate.

**Validation Evidence:** Every figure in the report was re-read from its source at the time
of writing, not carried forward from earlier in the session: the asset commit hash and its
480 files and 16,838,375 bytes from `git ls-tree -r -l`; the presence of 15 V2 FBX files on
the remote from `git ls-tree -r origin/main` after a fetch; `Games\IT` still at HEAD
`93add81` with its 162 staged deletions and its non-underscore remote; eight gate
screenshots present on disk. `npx eslint .` exits 0, `npx vitest run` reports 147 of 147,
and `npx playwright test` reports 12 of 12 across both viewports.

## v1.12.1+17 - 2026-08-31 - Refactor

**Author:** Claude Opus 5, unattended build session
**Reason:** Phase 15 verification. A sweep for unwaived numeric literals in gameplay code
found a handful of genuine tuning values sitting inline rather than named, which is the
standard about centralising tunables.

**Changes:**
- Moved into `src/core/constants.js` with units and reasons: piece and ball linear and
  angular damping, ground friction and restitution, the contact force event threshold,
  the damage tint threshold and depth, and the fragment spawn spread.
- `tests/unit/version.test.js`, eight tests asserting that `package.json`,
  `src/core/version.js`, the changelog head and the README all state the same version,
  that build numbers strictly decrease down the changelog, and that every changelog entry
  carries an author, a type and a Validation Evidence line.
- A browser test for continuing to the next level from the results screen.

**Why the version test matters more than it looks.** `docs/VERSIONING.md` already promised
that the test suite asserts every version location agrees, and that promise was false: no
such test existed. A document claiming a test that does not exist is worse than no claim.

**What the sweep left alone, deliberately:** mesh construction parameters such as cylinder
segment counts and bevel radii in `cannon.js` and `balls.js`. Those are geometry, not
gameplay tuning, and hoisting them would move art into a physics file.

**Validation Evidence:** `npx eslint .` exits 0 and `npx vitest run` reports 147 of 147
passing, up from 139. The version test was confirmed to be meaningful rather than vacuous
by the fact that it immediately held all fifteen existing changelog entries to the
evidence line rule and passed. Rerunning the literal sweep over `src/game`, `src/physics`
and `src/input` after the change leaves only constant definitions, mesh parameters and
values of 0, 1 and 2.

## v1.12.0+16 - 2026-08-31 - Documentation

**Author:** Claude Opus 5, unattended build session
**Reason:** Phase 14. A game with no accurate README is a folder, not a deliverable.

**Changes:**
- `README.md`, the front door. What the game is, requirements, install and run commands,
  controls, difficulty, project structure, tests, asset credits, licence.
- `LICENSE`, MIT, with a note that it does not cover `Reference/`.
- `CONTRIBUTING.md`, `CLAUDE.md` the agent router, `docs/ARCHITECTURE.md`,
  `docs/GAMEPLAY.md`, `docs/LEVEL_FORMAT.md`, `docs/ASSET_MANIFEST.md`,
  `docs/TESTING.md`.
- `docs/BLOCK_KIT.md`, generated by the new `scripts/write-block-kit-doc.mjs` from the
  manifest, the family table and the conversion report, so it cannot drift from the code.
- `docs/PROGRESS.md` updated with the real state of all sixteen phases, and the phase 5
  cheap fakes check the brief asks for by name.
- `eslint.config.js` moved to `ecmaVersion: 'latest'`, needed for the import attribute
  that lets `src/blocks/manifest.js` load under Vite, Vitest and plain Node alike.

**Every command written into these documents was run on this machine first,** which is a
defect the brief names on record from another of the owner's projects, where a guide told
the reader to run a script that was not where it said. `npm install`, `npm run dev`,
`npm run build`, `npm run serve:dist`, `npm run lint`, `npm test`, `npm run verify`,
`npm run e2e`, `npm run convert:blocks`, `node scripts/author-levels.mjs`,
`node scripts/write-block-kit-doc.mjs` and `node scripts/spike-body-budget.mjs` have all
been executed here.

**The worked example in `docs/LEVEL_FORMAT.md` was checked against the real file** rather
than typed from memory: `levels/01.json` was printed and compared line for line.

**Validation Evidence:** `npm run verify` exits 0, running ESLint clean over the whole
repository and 139 of 139 unit tests. `node scripts/write-block-kit-doc.mjs` regenerates
`docs/BLOCK_KIT.md` from live data, 117 lines covering 15 pieces. `npx vite build` still
succeeds after the import attribute change, and `npx vitest run` still passes, so the one
form of that import serves all three toolchains.

**Stated plainly rather than claimed:** the two GitHub Actions workflows are committed but
have not been observed running, and GitHub Pages needs one switch flipped by hand in the
repository settings before the deploy can succeed.

## v1.11.0+15 - 2026-08-31 - Test

**Author:** Claude Opus 5, unattended build session
**Reason:** Phase 13's browser half, and the continuous integration and deployment the
brief requires. The unit suite cannot see a hidden panel swallowing touches, a level that
never declares itself cleared, or a structure framed for the wrong size, and all three of
those were real defects in this build.

**Changes:**
- `playwright.config.js`. Two viewports, a phone at 390 x 844 and a desktop at 1280 x
  720, both against the production build served by `scripts/serve-dist.mjs`, with GPU
  flags so the browser uses real hardware instead of SwiftShader.
- `tests/e2e/smoke.spec.js`. Five tests per viewport: boot with every asset loaded and no
  console errors, a full playthrough from title to results, a shot that lands and
  registers impact energy, survival of a viewport change, and the four class visual gate.
- `.github/workflows/ci.yml`. Lint, block kit conversion, unit tests, build, bundle size
  summary, and the browser suite with screenshots kept as an artifact.
- `.github/workflows/deploy.yml`. Builds and publishes to GitHub Pages on every push to
  main.

**The visual gate's four classes, each with an acceptance criterion checked in code
rather than left for someone to remember:** the playing screen with the debug overlay
off, judged on the structure being present and standing; the playing screen with the
overlay on, judged on the overlay showing real frame rate and body counts; the level
select, judged on all thirty cells being present with no horizontal overflow; and the
results screen, judged on a star row and a score both being non-empty. All four are
captured at both viewports, so eight images per run.

**One switch the owner has to flip.** GitHub Pages cannot be enabled from a workflow. In
the repository settings, under Pages, set Build and deployment Source to "GitHub
Actions". Until that is done the deploy workflow fails at Configure Pages and nothing
else is wrong. After it is done the game is live at
https://ncd01.github.io/Impact-_Theory/

**Validation Evidence:** `npx playwright test` reports 10 of 10 passing across both
viewports, run against the real production build, not the dev server. One defect was
found and fixed while writing it: the gate clicked a locked level cell, which is a
disabled button, so Playwright waited for it to become enabled until the test timed out
after two minutes. Progress is now unlocked through an init script before the page loads.
Both workflow files are written but have not run, because this session cannot push a
workflow run and observe it; that is stated plainly rather than claimed as passing.

## v1.10.0+14 - 2026-08-31 - Refactor

**Author:** Claude Opus 5, unattended build session
**Reason:** The owner asked during the run for the game to be lightweight. The bundle was
measured rather than assumed, and 73 percent of it turned out to be one avoidable thing.

**Changes:**
- Switched from `@dimforge/rapier3d-compat` to `@dimforge/rapier3d` with
  `vite-plugin-wasm`, so the physics WebAssembly is emitted as a real `.wasm` asset
  instead of inlined as base64.
- Production source maps turned off. A 6.3 MB map served to a child's phone is waste.
- `scripts/serve-dist.mjs` and `npm run serve:dist`, a plain static server for checking a
  production build.
- `docs/DECISIONS.md` D-010 and D-011.

**Measured effect:**

| | Before | After |
|---|---|---|
| JavaScript | 3,530 kB | 881 kB |
| JavaScript, gzipped | 1,272 kB | 211 kB |
| WebAssembly, separate cacheable file | none | 2,021 kB, 774 kB gzipped |
| Source map, deployed | 6,330 kB | not emitted |
| Total deployed | 9,861 kB | 2,903 kB |
| Over the wire, gzipped | 1,272 kB | 985 kB |

A return visit re-downloads only the 211 kB of JavaScript, because the WebAssembly is now
a separately cached file rather than part of the script.

**A second finding, which would otherwise look like a broken deployment.** The production
build returns 404 for its own bundle under `vite preview`, while curl fetches the same URL
happily. Isolated by replaying the browser's headers through curl one at a time: the
request fails if and only if it carries `Sec-Fetch-Dest: script`, which every browser
sends for a module script. Vite's preview server rejects those. GitHub Pages is a plain
static host with no such middleware, which is why `serve-dist.mjs` exists.

**Validation Evidence:** Sizes are from the Vite build output before and after, not
estimated. The built game was then loaded in a real browser from the plain static server
at a 390 x 844 portrait viewport: it reached `ready`, loaded 15 of 15 models and all 30
levels, fetched the WebAssembly module with HTTP 200, had zero failed network requests and
zero console errors, and played. `npx vitest run` reports 139 of 139 passing and
`npx eslint .` exits 0.

## v1.9.0+13 - 2026-08-30 - Feature

**Author:** Claude Opus 5, unattended build session
**Reason:** Phases 8, 9, 11 and 12. The modules built so far were a playable slice with
no way in or out. This turns them into a game: a title, level select, a heads up display,
pause, settings, results with stars, difficulty, endless mode and sound.

**Changes:**
- `src/game/session.js`. One level attempt: balls remaining, the settle rule that gates
  clear and fail, and the scoring run.
- `src/ui/ui.js` and the interface stylesheet in `index.html`. Title, level select with
  locks and stars, heads up display, pause, settings, results, score popups.
- `src/audio/audio.js`. Every sound, synthesised. See D-008.
- `src/game/endless.js`. A seeded generator emitting the same level schema.
- `src/main.js` rewritten as a screen state machine.
- `tests/unit/endless.test.js`.
- `docs/DECISIONS.md` D-008 and D-009.

**Three defects found by playing the game in a browser rather than by reasoning:**
1. **Hidden screens still swallowed every touch.** `.screen { display: grid }` is a class
   selector and beats the browser's own `[hidden] { display: none }`, so the settings
   panel stayed laid out while invisible and intercepted presses meant for the level
   select behind it. Fixed with an explicit `[hidden] { display: none !important }`.
2. **A cleared level never showed its results.** The settle check counted every body's
   motion including balls, so a ball rolling slowly across the sand long after the tower
   had fallen kept the world "unsettled" forever. Motion is now measured over pieces and
   fragments only.
3. **Small levels were unreadable and large ones overflowed.** Framing is now computed
   from each level's own height and width. See D-009.

**Validation Evidence:** Played through in a real browser under Playwright at a 390 x 844
portrait viewport with the GPU enabled: title, Play, level select, level 1, fired until
cleared, results screen with stars, back to level select with level 2 now unlocked, and
zero console errors. Defects 1 and 2 were each found this way and each re-tested after
the fix. Framing was checked by capturing levels 1, 19 and 29, the smallest, a middling
one and the largest, and looking at all three. `npx vitest run` reports 139 of 139
passing, up from 126. `npx eslint .` exits 0.

## v1.8.0+12 - 2026-08-30 - Feature

**Author:** Claude Opus 5, unattended build session
**Reason:** Phases 6 and 7. Levels are data, not code, so that a level can be changed
without touching the game, endless mode can emit the same format, and a malformed level
fails the test suite instead of loading into an empty playfield.

**Changes:**
- `src/game/level.js`. The schema, a validator that reports every problem rather than
  the first, a level summary for the level select, and a loader that bundles levels at
  build time so a broken level is a build error rather than a blank screen.
- `levels/01.json` to `levels/30.json`, thirty levels.
- `scripts/author-levels.mjs`, the authoring source for those thirty designs.
- `src/save/save.js`. Versioned save with a migration chain, defensive reads, and best
  result tracking that never lowers a score on a worse replay.
- `src/game/scoring.js`. Piece values weighted by material family, a combo multiplier on
  a chain reaction from one shot, the saved ball bonus, and three star bands per
  difficulty.
- `tests/unit/levels.test.js`, `save.test.js`, `scoring.test.js`.

**On the level designs.** Each of the thirty is designed individually: its shape, its
piece choices, its material overrides and its par. The authoring script's helpers are
carpentry rather than generation, placing a row at a height or a pair of legs at a span,
so a design reads as the shape it is and so a piece height changing in the manifest does
not silently leave every level floating. Piece counts run from 3 on level 1 to 26 on
level 29, and par from 3 to 12.

**Validation Evidence:** `npx vitest run` reports 126 of 126 passing, up from 34. All
thirty shipped levels are run through the validator individually and all pass. The
validator's own rules are each tested by feeding it a level that breaks exactly that rule,
because a validator that passes everything would let all thirty pass while a piece id typo
shipped: unknown piece id, unknown family, an illegal support, a level of only supports, a
bad schema, an empty name, a non integer par, a piece below the ground, a non finite
coordinate, and a level over the 45 piece budget are each rejected. The save suite loads a
genuine schema version 1 save of the shape that version actually wrote and confirms all
five cleared levels and the unlock survive, and confirms the store survives non JSON text,
hostile field types and a storage that throws on write. `npx eslint .` exits 0.

## v1.7.0+11 - 2026-08-30 - Feature

**Author:** Claude Opus 5, unattended build session
**Reason:** Phase 3, the early decision. How many dynamic rigid bodies hold a playable
frame rate decides every level layout, every fragment count and every particle budget,
and discovering it late means re-authoring thirty levels.

**Changes:**
- `src/game/stress.js`, a generator that builds a wall of N pieces from the real kit.
- `?stress=N` in `src/main.js`, which replaces the level with that wall. A measurement
  affordance using the same `place()` call, colliders and materials a real level uses.
- `scripts/spike-body-budget.mjs`, the repeatable harness.
- Frame time and impact energy logs on the debug object, so the harness measures the
  running game rather than inferring from it.
- `docs/DECISIONS.md` D-006 and D-007. `docs/body-budget-spike.json`, raw output.
- `DESTRUCTION.MAX_FRAGMENTS` lowered from 46 to 36 and `LEVEL.MAX_PIECES` added at 45,
  both from the measurement.
- Per family hit points raised by one to two orders of magnitude, and the damage floor
  raised from 8 J to 25 J. See D-007.

**The measurement.** 264 samples across six runs, bucketed by the number of bodies live
at the moment of the sample: 60.0 fps at up to 24 bodies, 59.0 at 50 to 74, 55.9 at 75 to
99, 52.3 at 100 to 124, 43.8 at 125 to 149, 32.4 at 150 to 199, 19.6 at 200 to 299.
Ceiling for the 45 fps criterion is about 120 bodies, giving 84 after the required 30
percent headroom, and a 45 piece cap per level.

**A defect this uncovered.** Structures were destroying themselves. Hit points had been
guessed without measuring what an impact in this game is worth. Logging every impact gave
the answer: a standing structure produces 4613 contacts all under 10 J, while a collapse
produces a tail reaching 54057 J. The guessed values sat one to two orders of magnitude
below a real hit, so everything died to everything, which is one of the cheap fakes the
brief names by name. Recalibrated against the measured scale.

**Validation Evidence:** Numbers above are from `docs/body-budget-spike.json`, written by
the harness, not transcribed by hand. The renderer was confirmed to be real hardware,
`ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0,
D3D11)`, because the same harness without GPU flags reports SwiftShader and every number
under software rendering was meaningless. `npx vitest run` reports 34 of 34 passing and
`npx eslint .` exits 0.

**UNVERIFIED:** the number did not come from the target phone. It came from Chromium
mobile emulation at 390 x 844 and device pixel ratio 2 on an Intel Iris Xe, with CPU
throttling at 4x. Resolving question: on the son's actual phone, opening the deployed link
with `?stress=120`, does the frame counter hold at or above 45 fps through the collapse?

## v1.6.0+10 - 2026-08-30 - Feature

**Author:** Claude Opus 5, unattended build session
**Reason:** Phase 4, the vertical slice. A cannon, drag to aim, fire, a structure
standing on supports, a real collapse, and level clear detection, playable end to end in
a phone sized viewport.

**Changes:**
- `src/physics/world.js`. The Rapier world, body creation from collider descriptions,
  the fixed 60 Hz timestep, and the conversion of contact events into impact energy in
  joules using pre-step velocities and reduced mass.
- `src/physics/damage.js`. The energy to damage rule, kept pure so it can be tested
  without a physics world.
- `src/render/scene.js`. Renderer, fixed camera, lighting, ground, sky, and camera
  shake scaled to impact energy.
- `src/render/dust.js`. A pooled particle system for fracture dust.
- `src/render/materials.js`. The V2 material appearance, rebuilt in code.
- `src/game/structure.js`. Piece placement, damage routing, fracture into real rigid
  body fragments, and the single level clear rule.
- `src/game/balls.js`, `src/game/cannon.js`, `src/input/controls.js`,
  `src/blocks/loader.js`, `src/main.js`, `index.html`.

**A finding that changed the plan.** The V2 materialized FBX files carry material names
and per face material assignment, but no appearance at all. All twelve materials across
all fifteen files read back as `MeshPhongMaterial` with colour `#cccccc`, no texture map
and no useful specular. The V2 look was authored as procedural Blender node materials,
which FBX cannot carry, which is why `V2_MATERIAL_LIBRARY.blend` exists. Baking them
would need Blender, which is not installed on this machine. So appearance is rebuilt in
code, keyed to the same twelve authored material names, with colours read off the V2
preview renders. The per face assignment the FBX did preserve is what makes it work.
This is an approximation of the approved art direction, not the direction itself.

**Two rendering defects found by looking at the output rather than by reasoning:**
- The steel columns rendered solid black. three.js shades a metallic surface almost
  entirely from reflected environment light, and this scene has no environment map by
  design, so any metalness above zero renders black. Metalness is now zero everywhere
  and metal is carried by colour and a brushed texture.
- The brick arch rendered pale pink. Several authored meshes carry no `uv` attribute at
  all, so any texture applied to them sampled nothing. The conversion step now generates
  box projected UVs in Structural Units for every mesh, which also gives the whole kit
  one consistent surface scale.

**Validation Evidence:** The game was run in a real browser at a 390 x 844 portrait
viewport under Playwright, not merely built. It reported `ready`, 15 of 15 models
loaded, 0 failed, and no console errors of any kind across three runs. Firing eighteen
shots brought the structure from 9 standing pieces to 0, with 11 pieces destroyed and 41
fragments created, and `cleared` became true. Screenshots of the standing structure and
of the resulting rubble field are in `.agent_temp/screenshots`. After the UV fix, a
reload of all fifteen converted models confirmed 28 of 28 meshes carry a `uv` attribute
and 15 of 15 still conform to the manifest. `npx eslint .` exits 0.

**Not yet true:** there is no interface, no scoring, no level file format and no audio.
Difficulty constants exist and are applied but are not selectable. Frame rate measured
under headless Playwright is software rendered and is not a valid measurement of the
target device; the body budget spike has not been run.

## v1.5.1+9 - 2026-08-30 - Fix

**Author:** Claude Opus 5, unattended build session
**Reason:** The dev server could not start at all. The master working copy is on an SMB
network share, and Windows cannot deliver native filesystem change notifications across
one, so chokidar's watcher threw `UNKNOWN: unknown error, watch` and took the whole
process down within a second of `vite` starting.

**Changes:**
- `vite.config.js` `server.watch` set to polling, which is the documented fallback for
  network filesystems, at a 600 ms interval with `node_modules`, `.git`, `_source`,
  `Assets` and `.agent_temp` excluded from the walk.

**Alternative rejected:** moving the working copy to local disk. A junction from the
share to local disk was tried first and failed, because Windows cannot create a reparse
point on an SMB share. A second working copy on `C:` was rejected because that is the
exact arrangement that has already cost this owner once, when a duplicate tree was found
pointing at another project's remote. See `docs/DECISIONS.md` D-005.

**Validation Evidence:** `npx vite --port 5173` previously exited within a second with
the watcher error. After the change the server stayed up and `curl -s -o /dev/null -w
"%{http_code}" http://localhost:5173/` returned 200. A full Playwright run against it
loaded the page, ran the game and reported no console errors.

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
