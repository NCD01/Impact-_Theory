# Handoff

Written 2026-08-31 at the end of an unattended overnight session. Version at handoff:
**1.12.2+18**.

## 1. Bottom line

**The game is playable end to end and it works**: title, level select, thirty levels,
aim, fire, real collapses, stars, progress that saves, endless mode, sound, on a phone
sized screen and in a desktop window. The existing art tree including the V2 block library
is committed and pushed, verified against the remote, which was the night's most urgent job
and was done inside the first hour.

**What needs attention first:** flip one switch to make the link exist (Settings, Pages,
Source: GitHub Actions), then look at whether the destruction actually *feels* good, which
is the one judgement an unattended session cannot make. And read section 5, because the
brief's claim that your V2 library was unbacked up and that two of your commit messages
were false is **not true**, and the real situation is worth ten seconds of your attention.

## 2. How to run it

**Not yet on a URL.** GitHub Pages cannot be enabled from a workflow, and this session has
no browser to click through your repository settings.

**The one switch:** github.com/NCD01/Impact-_Theory → Settings → Pages → under "Build and
deployment" set **Source** to **GitHub Actions**. The workflow is already committed and
already pushed, so it will run on the next push, or immediately from the Actions tab via
"Deploy to GitHub Pages" → Run workflow. After that the link is:

    https://ncd01.github.io/Impact-_Theory/

**Locally, right now:**

    cd "H:\Marcelo\Programming\Games\Impact Theory"
    npm install
    npm run dev

**To try the real deployable build:**

    npm run build
    npm run serve:dist        # then open http://localhost:4180/Impact-_Theory/

Use `serve:dist`, not `npm run preview`. Vite's preview server 404s the game's own bundle
over a `Sec-Fetch-Dest: script` header. That is a preview server quirk, not a deploy
problem, and it is diagnosed in `docs/DECISIONS.md` D-011.

**State of every location:**

| Location | State |
|---|---|
| `H:\...\Games\Impact Theory` | The repository. Clean tree, 18 commits, all pushed. |
| `H:\...\Games\IT` | **Untouched.** Verified at the end: same HEAD `93add81`, same remote (the non-underscore one), same 162 staged deletions it already had, no new commits. Only read-only git commands were ever run there and no fetch. |
| `H:\...\Games\Governance` | Read only. Read, never written. |
| `C:\apps\Impact Theory` | Holds a stray `Assets` and `Reference` copy that predates this session, plus an empty `_local` folder from a failed experiment. Nothing depends on it. Safe to delete. |
| Remote `Impact-_Theory` | 18 commits, 578 files, in sync with local. |

## 3. The asset backup

**Done, first, and verified.**

| | |
|---|---|
| Commit | `9f848f23ed64ad4a7abf88f39afd8f95aee71110` |
| Message | `Asset: back up the entire existing Assets tree verbatim, V2 block library included - v1.1.0+2` |
| Files | 480 |
| Size of that tree | 16,838,375 bytes, about 16.1 MiB |
| Excluded | Nothing for size. No file came close to 50 MB, so no Git LFS. |

**The V2 materialized block library is on the remote.** Verified by fetching and running
`git ls-tree -r origin/main`, which returns all 15 V2 FBX variants plus the V2 previews,
`material_variant_manifest_v2.json` and `validation_report_v2.json`. Not inferred from a
successful push; read back off the remote.

Before committing, file counts per extension were compared against disk: 30 FBX, 75 PNG,
5 blend, 2 blend1, 8 JSON, 1 CSV, 2 db, all matching.

**Two Windows `Thumbs.db` caches and their Unity `.meta` sidecars** were committed
verbatim in that commit and then untracked in the next one. The brief required both a
verbatim commit and a gitignore excluding OS junk, and those two rules collide on exactly
those four files. The backup instruction won, so nothing was dropped, and they remain
retrievable from `9f848f2` forever.

**The Unity checkpoint** was moved into `_source/unity-checkpoint/` with `git mv`, all 337
moves recorded by git as renames, so `git log --follow` on any file reaches back through
the move. Nothing was deleted at any point. See `docs/ARCHIVE.md`.

## 4. The early decision: the body budget

**About 120 concurrent dynamic bodies hold 45 fps. Budget after the required 30 percent
headroom: 84. Level cap: 45 pieces.**

Measured across six runs and 264 samples, bucketed by the number of bodies actually live
at the moment of each sample:

| Live bodies | Samples | Mean fps | p95 worst |
|---|---|---|---|
| 0 to 24 | 14 | 60.0 | 60.0 |
| 25 to 49 | 48 | 58.8 | 53.3 |
| 50 to 74 | 54 | 59.0 | 52.5 |
| 75 to 99 | 51 | 55.9 | 46.7 |
| 100 to 124 | 31 | 52.3 | 41.2 |
| 125 to 149 | 27 | 43.8 | 31.8 |
| 150 to 199 | 24 | 32.4 | 20.0 |
| 200 to 299 | 15 | 19.6 | 12.6 |

Measured on the real converted kit with the real colliders, materials, camera and fixed
timestep. Raw output in `docs/body-budget-spike.json`. Reproduce with
`node scripts/spike-body-budget.mjs`.

**`UNVERIFIED`: this did not come from your son's phone.** It came from headless Chromium
in mobile emulation at 390 by 844 and device pixel ratio 2, on this laptop's Intel Iris Xe,
with CPU throttling at 4x standing in for a phone processor. Confirmed to be real hardware
rather than software rendering: without the GPU flags the same harness reports SwiftShader
and every number under it was meaningless.

**Resolving question:** on his actual phone, open the deployed link with `?stress=120` and
watch the frame counter in the corner through the collapse. Does it hold at or above 45?

**Cost of reversing it now: low.** Every level is a data file and the caps are two named
constants. If the phone says 80 rather than 120, lower `LEVEL.MAX_PIECES` and
`DESTRUCTION.MAX_FRAGMENTS` and rerun `node scripts/author-levels.mjs`. No code changes.
The largest shipped level is 26 pieces, comfortably inside even a halved budget.

## 5. Three corrections to the brief. Read this one.

The brief asked that anything measured beats anything it asserts. Three of its measured
claims did not hold up, and the second is the one that matters to you.

**5.1. There is no `Games\Impact` folder.** The project the brief describes under that
name is at `Games\IT`. Everything else about it matches: the non-underscore remote, the
governance pack, `v0.14`. Treated as the read-only project it meant.

**5.2. Your V2 library was already backed up, and your commit messages were not false.**
The brief states that `Assets/Art/Blocks/MaterialVariants` returns zero files from
`git ls-files` in that repository, that the directory is absent from its disk, and
therefore that the two commits claiming to have protected the V2 library are lying.

The first two facts are true. The conclusion is not. `git ls-tree -r origin/main` in that
repository returns **all 18 files** under `MaterialVariants`, including all 15 V2 FBX
variants. They are in that project's history and on its GitHub remote. **The commit
messages were accurate.**

**5.3. What is actually wrong there, and you may not know it.** That working tree has
**162 staged deletions sitting uncommitted**. Somebody deleted the files from disk and
staged the deletions without committing. That is why `git ls-files` reports nothing and why
the directory is missing from disk. The files are safe in history and on the remote, but
**if those staged deletions are ever committed and pushed, that working copy loses them.**

Nothing was done about it, because that project is read only for this build. It is
`git restore --staged --worktree .` in that repository, run by someone who has first
checked that the deletions were not deliberate. Your call, not mine.

None of this changed the plan. The backup still went first, because this folder genuinely
had no version control of its own and a copy on a second remote is worth having.

## 6. Every phase

| Phase | State | One line |
|---|---|---|
| 0. Ground truth and toolchain | **done** | Workspace measured, three brief corrections found, toolchain proved by running it. |
| 1. Repo, asset backup, docs, first push | **done** | Assets committed and pushed inside the first hour, verified against the remote. Unity checkpoint moved with `git mv`. |
| 2. Block kit pipeline | **done** | Scripted FBX to glTF conversion that checks itself. 15 of 15 conform. |
| 3. Body budget spike | **done** | 264 samples, ceiling 120 bodies, section 4 above. |
| 4. Vertical slice | **done** | Cannon, drag to aim, fire, structure on supports, real collapse, clear detection. |
| 5. Destruction feel | **partial** | Mechanism complete and honest, see section 10. **No human ever watched it and judged whether it feels good.** |
| 6. Level format and 30 levels | **done** | JSON keyed to manifest ids, validator, 30 levels, level select, versioned save with migration. |
| 7. Scoring, stars, combos | **partial** | Model complete and tested. **Star thresholds were not tuned by playing all thirty levels**, they follow a rule from par. |
| 8. Difficulty modes | **done** | Easy and Normal as tuning tables, one code path, stored in the save. |
| 9. Endless mode | **done** | Seeded generator, same schema, 200 rounds validated. |
| 10. Remaining art and environment | **skipped** | See section 10. The playfield is sand and sky with no backdrop. |
| 11. Audio | **done** | Every sound synthesised, scaled by impact energy, voiced per material family. |
| 12. Interface and menus | **done** | Title, select, HUD, pause, settings, results, popups. Portrait first, checked in landscape. |
| 13. Tests | **done** | 147 unit, 12 browser across two viewports, four class visual gate with criteria asserted in code. |
| 14. Documentation and deploy | **partial** | Every document written, every command in them run here. **Pages needs your one switch.** |
| 15. Final verification and report | **done** | This file. |

## 7. Decisions made alone

The section you should scrutinise hardest. Full reasoning for each is in
`docs/DECISIONS.md`.

| # | Decision | Alternative rejected | Reversing it |
|---|---|---|---|
| D-001 | Treat `Games\IT` as the read-only project the brief called `Games\Impact` | Report the project as missing and stop | Nothing to reverse |
| D-002 | Do not adopt the governance pack; use `MAJOR.MINOR.PATCH+BUILD` | Adopt the pack's `vX.Y` | Easy, nothing blocks adoption later |
| D-003 | Reference clip is reference, not a licence | Not a real alternative | Not applicable |
| D-004 | **Plain JavaScript, not TypeScript** | TypeScript, which the brief left to my judgement | Moderate. Vite compiles TS with no config change; migration is file by file |
| D-005 | Keep one working tree on the network share | A second copy on `C:` for speed | Not in use. The share proved workable at 2 minutes for a full install |
| D-006 | **Body budget: 120 bodies, 45 pieces per level** | Guessing, or measuring on placeholder cubes | Low. Two constants and a rerun of the level authoring script |
| D-007 | **Recalibrated hit points by 1 to 2 orders of magnitude** | Keep the guessed values | Trivial. Named constants with reasons attached |
| D-008 | **Synthesised all audio instead of sourcing CC0 files** | Download a CC0 pack | Low. One function per sound in one file |
| D-009 | Place levels by size rather than moving the camera | Move the camera closer for small levels, which put it in front of its own barrel | Low. One function |
| D-010 | **Swapped Rapier compat for the standard build**, cutting deployed size 70 percent | Keep compat as the brief specified | Trivial. Four lines |
| D-011 | Test the build with a plain static server, not `vite preview` | Assume preview's 404 meant the build was broken | Not applicable |

**The four worth your attention:**

**D-004, JavaScript over TypeScript.** Chosen because a type error blocking a build at 4am
costs the whole remaining night, and Rapier's WebAssembly wrapper plus three.js geometry
tend to produce type errors resolved by casts rather than by finding real bugs. If you want
TypeScript, say so; the code is written as ES modules with explicit imports to keep that
door open.

**D-007, the damage recalibration.** The first hit point values were guessed and every
structure vaporised on contact. Fixed by logging every impact the simulation produces and
setting the values against the measured distribution. This is the single change that took
the game from broken to working, and the measurement is in the decision log.

**D-008, synthesised audio.** The brief asked for CC0 files with licences in the manifest.
I could not verify a licence at 2am with nobody to ask, and your own standard says no asset
ships without a licence you read. So there are no audio files at all. The trade is honest:
it sounds thinner than samples would, and it carries zero licence risk.

**D-010, the bundle.** You said mid-run that it needs to be lightweight, so I measured
rather than assumed. The compat Rapier build the brief specified inlines a 2 MB WebAssembly
module as 2.57 MB of base64, which was 73 percent of the bundle. Deployed payload went from
9,861 kB to 2,903 kB, and gzipped transfer from 1,272 kB to 985 kB. A return visit now
re-downloads only 211 kB, because the WebAssembly caches separately.

## 8. Block kit conformance

**All fifteen pieces survived conversion with correct dimensions and pivots.** Measured by
the conversion step itself against `block_asset_manifest.json`, to a 1 mm tolerance, and
independently re-asserted by the unit suite against a restated copy of the manifest table.

Both geometric-center pivots are correct: `A03_CROSS_BEAM` at min Y −1.5 SU and
`A04_ROLLER` at −0.5 SU. The thirteen center-bottom pivots all sit at 0.

The full generated table is in `docs/BLOCK_KIT.md`. Nothing failed.

**Two findings from the conversion:**

**The FBX kit is authored in centimetres.** A 1 SU cube measures 100 FBX units. Scaled at
conversion, so every `.glb` is in Structural Units and no runtime code knows about
centimetres.

**Your V2 FBX files carry no material appearance.** All twelve materials across all fifteen
files read back as `MeshPhongMaterial`, colour `#cccccc`, no texture map. Not a defect in
your art: the V2 look was authored as procedural Blender node materials, which FBX cannot
carry, which is why `V2_MATERIAL_LIBRARY.blend` exists. Baking them needs Blender, which is
not installed on this machine.

So appearance is rebuilt in code, keyed to the same twelve material names your art pass
assigned, with colours read off your own V2 preview renders. The per face assignment the
FBX *did* preserve is what makes it work: end grain still lands on the ends of a beam
because your art said so. **This is an approximation of your approved art direction, not
the direction itself.** If you install Blender, baking the real materials to textures would
be a visible upgrade and would not touch any code outside one file.

## 9. Fidelity ledger, against the reference clip

| Clip | This game | Why |
|---|---|---|
| Portrait, camera behind and above a cannon, fixed during play | Same | Matches |
| Flat sand playfield | Same | Matches |
| **Painted beach backdrop: sea, palms, bunting, a hut** | **Absent. Sand plane and a sky dome only** | Phase 10 skipped. **The largest visible difference** |
| Structures on distinct pedestals that survive | Same, via the support mechanic | Matches, and clear detection ignores supports |
| Striped ball ammunition | Same, stripes baked as vertex colours | Matches. Colours original |
| Several balls in flight at once | Same, hold to stream at a capped rate | Matches |
| Muzzle flash and a light patch on the sand | Same | Matches |
| Blocks tumble as rigid bodies | Same | Matches |
| Some blocks break into rubble with a dust puff | Same, real rigid body fragments | Matches |
| Collapse completes in under five seconds | Similar, not measured against the clip frame by frame | Approximate |
| **No HUD visible** | **A HUD is shown** | Deliberate. The brief said to build one regardless, and the clip is not evidence its game has none |
| Ornate decorated pedestals | Plain kit columns | The kit has no decorated pedestal, and no new modelling was in scope |
| A pointing hand graphic | Absent | Treated as a recording indicator, not a game object |

**No name, art, sound, icon, interface text or level layout from the clip appears
anywhere.** Piece names come from your manifest. Level names, colours, copy and layouts are
original.

## 10. What is broken or missing

Ordered by consequence, not by how alarming it sounds.

**1. No backdrop or environment art.** Phase 10 was skipped. The playfield is a sand plane
under a sky dome. It reads as clean rather than broken, but it is the clearest gap against
the reference and the first thing a child would notice. *Consequence: cosmetic, but it is
what the game looks like.*

**2. Destruction was never judged by a person.** The mechanism is real: energy based
damage, real fragment bodies, dust, energy scaled shake and audio, momentum through the
stack, supports that drop their load. Every one of the five cheap fakes the brief names was
checked and none shipped; the table is in `docs/PROGRESS.md`. **But whether it feels good
is a judgement nobody made**, because it needs someone watching a screen. *Consequence: the
phase the brief called hardest is mechanically complete and aesthetically unvalidated.*

**3. Star thresholds were not tuned by playing the levels.** They follow a rule from each
level's par rather than from observed play. Some levels are probably too generous and some
too mean. *Consequence: progression feels uneven until someone plays through.*

**4. Pars are estimates.** Each level's par was chosen by eye from its size and difficulty,
not by playing it. On Normal, par sets the ball allowance, so **a badly estimated par makes
a level unwinnable on Normal.** Easy is unaffected, having unlimited balls, and Easy is the
default. *Consequence: potentially a blocking bug on Normal for some levels. Untested.*

**5. Nothing has run on a real phone.** Everything is Chromium mobile emulation on a
laptop. Touch is emulated. *Consequence: the target platform is unverified.*

**6. The GitHub Actions workflows have never run.** Written carefully, never observed.
*Consequence: the first push may need a fix.*

**7. No deterministic physics replay test.** The brief asked for a fixed seed, fixed
timestep rig asserting a known structure collapses. The timestep is fixed and the generator
is seeded, but Rapier's solver is not seeded from here, so a rig asserting exact positions
would be brittle. The browser suite asserts the outcome instead. *Consequence: a physics
regression could pass the suite if the level still ends up cleared.*

**8. Fracture fragments are plain boxes** regardless of the shape they came from. Settled
in the spike: a compound collider per chip is the fastest way to spend the budget on
rubble. *Consequence: debris from an arch looks like debris from a crate.*

## 11. Every `UNVERIFIED` value, with the question that settles it

| Value | Question that would settle it |
|---|---|
| **Body budget of 120 concurrent bodies** | On his phone, open the link with `?stress=120` and watch the frame counter through the collapse. Does it hold at or above 45 fps? |
| **Fire mode in the reference game** | Does one tap there produce one ball or a burst? Unreadable from nine stills. This build does tap-for-one and hold-to-stream, which covers both. |
| **Whether the reference game has a HUD** | Does its gameplay show a score and an ammo count? No interface appears in any of the nine frames. This build shows a HUD regardless, as the brief instructed. |
| **Par for each of the thirty levels** | Play each level on Normal. Is it clearable within par? This is the most likely place a real bug is hiding. |
| **That the levels are fun in the order given** | Play levels 1 through 10 with a child. Does difficulty rise smoothly? |
| **Whether the synthesised audio is good enough** | Listen to it with the sound on. Do impacts read as material specific, or as beeps? |
| **That touch input feels right** | Aim and fire with a thumb on a real phone. Is 620 pixels per radian too twitchy or too slow? |

## 12. Open questions for you

1. **Do you want TypeScript?** D-004 chose plain JavaScript for unattended-run safety. The
   code is structured to migrate. Your call.
2. **Do you want real audio samples?** D-008 synthesised everything to avoid unverifiable
   licences. If you will vouch for a CC0 pack, swapping it in touches one file.
3. **Do you want the environment art?** Palms, a hut, a sea backdrop. That is phase 10, and
   it is the biggest visible gap. It needs either sourced CC0 assets you licence-check or
   more modelling from you.
4. **Is Blender available anywhere?** If so, baking your V2 procedural materials to textures
   would replace my approximation with your actual art direction.
5. **What should happen at the end of level 30?** Currently it returns to the level select.
   No ending, no credits.
6. **Those 162 staged deletions in `Games\IT`.** Deliberate or accidental? See section 5.3.
7. **Is `C:\apps\Impact Theory` safe to delete?** It holds a copy of `Assets` and
   `Reference` that predates this session. Nothing here depends on it.

## 13. The next three moves

**1. Flip the Pages switch and open the link on his phone.** Settings → Pages → Source:
GitHub Actions. Then load it, play level 1, and watch what a six year old does with it.
Ten minutes, and it turns everything above from a claim into an observation.

**2. Play all thirty levels on Normal and fix the pars.** This is where a real bug most
likely is: a par set too low makes a level unwinnable on Normal. Pars live in
`scripts/author-levels.mjs`; change a number, rerun `node scripts/author-levels.mjs`,
`npm test`. While playing, tune the star bands in `src/core/constants.js`.

**3. Decide on the environment art, and judge the destruction.** Both need a person. If the
collapses feel limp, the levers are `SHAKE.AMPLITUDE_PER_JOULE`, the `DESTRUCTION` block
and the per family hit points, all named constants with their reasoning attached in
`src/core/constants.js` and `src/blocks/families.js`.

---

## Verification checklist

| Check | Result |
|---|---|
| Linter clean on the final commit | Yes. `npx eslint .` exits 0 |
| Tests green on the final commit | Yes. 147 unit, 12 browser |
| Game launches and is playable start to finish | Yes. Title, select, play, clear, stars, next level, back to select, all driven in a real browser |
| Playable in a portrait phone viewport with touch input | Yes, at 390 by 844 with touch emulation. **Not on a real phone** |
| All 15 converted pieces load and match the manifest | Yes, dimensions and pivots, to 1 mm |
| Every asset loads at runtime | Yes. 15 of 15 models plus the WebAssembly module, confirmed from network responses and a runtime load count, not from the manifest |
| Four screenshot classes captured | Yes, 8 images (4 classes x 2 viewports) in `.agent_temp/screenshots/` |
| Full original `Assets\` tree committed and pushed, V2 included | Yes, verified by fetching and reading `git ls-tree` on `origin/main` |
| `_source/unity-checkpoint` moved with `git mv`, history intact | Yes, 337 renames |
| No unwaived magic literals in gameplay code | Yes, after a sweep and a cleanup commit. Mesh construction parameters deliberately left in place |
| File headers and constant comments present | Yes, every source file |
| README accurate, every command personally run | Yes. Two errors found and fixed during final verification: stale test counts and Rapier's licence, which is Apache 2.0 and not MIT |
| One version number, agreeing everywhere | Yes, and now asserted by 8 unit tests rather than promised |
| Changelog head matches the current version | Yes, asserted by test |
| `git status` clean, local HEAD matches the remote | Yes |
| `Games\IT` untouched | Yes. Same HEAD, same remote, same pre-existing 162 staged deletions, no new commits |
| `docs/PROGRESS.md` has a line for every phase | Yes, all sixteen |

**One thing the standards require me to state plainly.** Runtime startup validation *was*
performed: the game was launched in a real browser many times over the night, at two
viewports, against both the dev server and the production build, and I looked at the
screenshots. This is not a green light claimed from a passing build.

**Every claim in this document is something I verified by running or reading, not something
I expected to be true because I wrote the code for it.**
