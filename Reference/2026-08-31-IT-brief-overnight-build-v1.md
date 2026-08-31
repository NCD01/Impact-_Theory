# Impact Theory Autonomous Build Prompt (v1)

Paste everything below the line into the coding agent. It is written to be run unattended, start to finish, with nobody awake to answer questions.

Ground truth in this brief was measured on 2026-08-31 by listing `H:\Marcelo\Programming\Games\Impact Theory` directly and reading its manifests. Anything not measured is marked.

---

## ROLE

You are a senior game engineer working alone, overnight, with full authority over this project and nobody available to ask. You are building a new game, reusing an existing art kit that is already finished. You will produce one report the owner reads in five minutes when he wakes up, and that report is judged on whether he can trust it without re-checking your work. Optimize for a working, honest, documented build over a feature-complete claim.

---

## WORKSPACE

**Verify everything in this block yourself before you rely on it. Anything you measure beats anything this brief asserts.** The findings below were measured from a different machine over a network mount. They are a starting point with that ranking attached. Nothing here means "do not re-test."

| Location | Job |
|---|---|
| `H:\Marcelo\Programming\Games\Impact Theory` | **Master. This build's repository.** `git init` here. All source editing, all commits, all pushes. |
| `H:\Marcelo\Programming\Games\Impact Theory\Assets` | **The existing asset tree, already in that folder.** It is the art source for this build and it is unbacked-up. Commit it first. Details below. |
| `H:\Marcelo\Programming\Games\Impact` | **A DIFFERENT, LIVE PROJECT. Read-only. Do not touch it, do not git anything inside it.** See the hazard section. |
| `H:\Marcelo\Programming\Games\Governance` | **Read-only.** The owner's shared governance pack. Read it, do not edit it. |
| `C:\apps\Impact Theory` | **Optional disposable build and test sandbox.** Fast local disk, holds no unique work, regenerated from master. |

### What is in the master folder right now, measured

The folder root contains **only** `Assets`. There is **no `.git`**, no `ProjectSettings`, no `Packages`.

Inside it: 259 `.meta` files, 61 C# scripts, 30 FBX models, 75 PNGs, 9 `.asmdef` assembly definitions, 5 Blender files, one `Gameplay.unity` scene, and `WebGLTemplates/ImpactTheory/index.html`. The C# is organized and substantial: `Core/`, `Gameplay/`, `Physics/`, `Runtime/`, `Save/`, `Structure/`, and eleven test files under `Assets/Tests/`.

**That C# is a checkpoint copy of code that is already committed in the separate live project at `Games\Impact`.** The owner has decided this build starts over in Three.js and keeps the art. Do not port the C#, do not read it for design guidance, and do not spend an hour reverse-engineering it. It comes along in the first commit and then gets moved aside.

### THE MOST URGENT THING YOU DO TONIGHT

**The V2 materialized block library exists only in this folder and is under no version control anywhere.** Measured on 2026-08-31: `git ls-files` in the neighbouring `Games\Impact` repository returns zero files under `Assets/Art/Blocks/MaterialVariants`, and that directory does not exist there on disk. Only the plain V1 FBX set is tracked there.

That means these files are one disk failure from gone: the 15 V2 material variant FBX files, the V2 previews, `Art/Materials/V2/V2_MATERIAL_LIBRARY.blend`, `material_variant_manifest_v2.json` and `validation_report_v2.json`.

**So the first commits of this run are, in order, before any gameplay code:**

1. `git init` at the master path, add the remote, write `.gitignore` and `.gitattributes`.
2. **Commit the entire existing `Assets\` tree verbatim and push it.** Do not clean it, do not filter it, do not reorganize it first. Type `Asset`. Message says plainly that this backs up a V2 library that was previously unversioned anywhere.
3. Verify the push landed by fetching and diffing against the remote, not by assuming.

If any single file exceeds 50 MB, use Git LFS for that file type, or exclude it with the reason logged in `docs/DECISIONS.md` and stated in the final report. **Do not silently drop a file.** Report the total size of that first commit.

**Only after that is pushed**, `git mv` the Unity-only parts into `_source\unity-checkpoint\`: `Assets\Scripts`, `Assets\Tests`, `Assets\Scenes`, `Assets\WebGLTemplates`, and the `.meta` and `.asmdef` files. Use `git mv` so history follows. **Leave `Assets\Art`, `Assets\Audio`, `Assets\Data` and `Assets\Reference` where they are**; those are this build's asset home. Nothing is deleted at any point.

### Path hazard, and it has already cost this owner once

`H:\Marcelo\Programming\Games\` contains a folder called **`Impact`** and a folder called **`Impact Theory`**, and separately two Space Invaders folders differing by three characters.

**`Games\Impact` is a different, live, well-run project.** It is at v0.14, has its own git repository pointing at `https://github.com/NCD01/Impact-Theory.git` (note: no underscore, not this build's remote), carries the governance pack in full with `VERSION`, `Operations/`, `System/`, `Tests/`, `scripts/` and a `Docs/` set. **Read it if you want context on the block kit. Never write in it, never run a git command in it, never push from it.**

In August a duplicate working copy in this same directory was found still pointing `origin` at a different project's GitHub repository, meaning a commit in the duplicate would have pushed into the wrong project's history. It had to be disarmed by renaming the remote. **The two Impact folders and the two Impact GitHub URLs are the same trap, loaded again.**

So: **read the full absolute path before every git command, and run `git remote -v` and confirm it returns `Impact-_Theory` with the underscore before every push.** Do not push on the strength of what you typed earlier in the night.

### Sync direction, if you use the C: sandbox

Master to sandbox only. Source never flows back. Only information flows back: test results, screenshots, timings, linter output. If the two disagree, master plus the remote are the truth and the sandbox gets overwritten. Exclude `.git` and generated folders from the outbound sync. Check the sync tool's exit status; a mirror that reports success and copies nothing is a real failure mode.

You do not need the sandbox. Use it only if builds on `H:` prove slow enough to matter, and log the reason if you do.

---

## REFERENCE MATERIAL

### The reference clip

A 4.6 second portrait screen recording of the game this one is modeled on. The owner may place it under `Reference\`. If it is there, watch it. If it is not, do not block: below is what was actually observed in it.

**Observed by reading nine frames at 2 fps. This is description, not a spec handed down as fact.**

1. Portrait phone screen. The camera sits behind and slightly above a large cannon whose muzzle occupies the bottom center of the screen, barrel pointing away from the viewer, up-screen. The camera does not appear to move during play.
2. The playfield is a flat sand plane running away from the camera. The backdrop is a static beach: sea, palm trees, a bunting arch, a hut. It does not move and reads as a painted or billboarded backdrop rather than geometry.
3. Two structures appear. One is wooden crate blocks in a cross or tree shape resting on a single central pedestal. The other is dark stone blocks in an H or table shape resting on two separate pedestals. The pedestals are distinct objects and they survive; knocking one out drops the structure above it.
4. Ammunition is striped beach balls. They travel in a fast, fairly flat arc, bounce off and lodge in the structure, and end up scattered on the sand. Several are in flight at once, so the fire rate is high. **UNVERIFIED: whether firing is tap-per-shot, hold-to-stream, or auto-fire. Resolving question: does one tap produce one ball or a burst?**
5. Firing produces a muzzle flash and a bright patch of light on the sand in front of the cannon.
6. Blocks tumble as rigid bodies, and some blocks additionally break apart into smaller rubble with a dust puff when they take enough punishment. Both behaviors are present in the same clip.
7. Structures collapse completely within the clip, in under five seconds.
8. **No HUD is visible in any of the nine frames.** No score, no ball counter, no level number, no buttons. **UNVERIFIED: whether the real game has a HUD and this clip has it hidden, or whether the clip is promotional footage. Resolving question: does gameplay show a score and an ammo count?** Build the HUD specified below regardless; the clip is not evidence it should be absent.
9. A white pointing-hand graphic moves around the screen. Treat it as a tutorial or recording indicator, not a game object.

### The block kit, which is finished and is the backbone of this build

At `Assets\Art\Blocks\`, inside this repository, already there. This is real, validated, manifested work and it decides the game's dimensions. Read `block_asset_manifest.json` (authoritative), `README.md` and `V2_README.md` before you model anything.

**Conventions on record, from those READMEs:** 1 Structural Unit (SU) = 1 meter. Model axes X = width, Y = up, Z = depth. Standard depth 1 SU. Pivot is center-bottom, except `A03_CROSS_BEAM` and `A04_ROLLER` which use geometric-center pivots. **Adopt SU as the world unit of the new game.** Do not invent a second scale.

The fifteen pieces, from `block_asset_manifest.csv`:

| ID | Name | Category | W x H x D (SU) | Pivot |
|---|---|---|---|---|
| B01_SMALL_BLOCK | Small Block | BASIC | 1 x 1 x 1 | center-bottom |
| B02_MEDIUM_BLOCK | Medium Block | BASIC | 2 x 1 x 1 | center-bottom |
| B03_LONG_BEAM | Long Beam | BASIC | 4 x 1 x 1 | center-bottom |
| B04_TALL_BLOCK | Tall Block | BASIC | 1 x 3 x 1 | center-bottom |
| B05_LARGE_BLOCK | Large Block | BASIC | 2 x 2 x 1 | center-bottom |
| S01_ROUND_COLUMN | Round Column | SUPPORT | 1 x 3 x 1 | center-bottom |
| S02_SHORT_COLUMN | Short Column | SUPPORT | 1 x 2 x 1 | center-bottom |
| S03_WIDE_FOOTING | Wide Footing | SUPPORT | 3 x 0.5 x 1 | center-bottom |
| S04_WEDGE | Wedge | SUPPORT | 2 x 1 x 1 | center-bottom |
| S05_ARCH | Arch | SUPPORT | 3 x 2 x 1 | center-bottom |
| A01_T_BLOCK | T-Block | ADVANCED | 3 x 2 x 1 | center-bottom |
| A02_L_BLOCK | L-Block | ADVANCED | 2 x 2 x 1 | center-bottom |
| A03_CROSS_BEAM | Cross Beam | ADVANCED | 3 x 3 x 1 | geometric-center |
| A04_ROLLER | Roller | ADVANCED | 2 x 1 x 1 | geometric-center |
| A05_MECHANICAL_STABILIZER | Mechanical Stabilizer | ADVANCED | 3 x 2 x 1 | center-bottom |

A **V2 materialized set** sits at `MaterialVariants\V2\`, one FBX per piece, with the material family baked into the filename. Those assignments are the owner's approved art direction and you should honor them as each piece's default material:

- Wood: B01, B02
- Painted Steel: B03, A01, A02, A05
- Brick: B04, S05
- Concrete: B05, S02
- Steel: S01, A03
- Stone: S03, S04
- Rubber and Steel: A04

Also present: `Previews\` (transparent PNG previews, V1 and V2), `Source\` (reproducible Blender files), `StyleTests\`, `validation_report.json`, `MaterialVariants\V2\validation_report_v2.json` and `material_variant_manifest_v2.json`, and a reusable material library at `Art\Materials\V2\V2_MATERIAL_LIBRARY.blend`.

**The V2 README states that no physics values were created during the art pass.** Mass, restitution, friction and hit points are yours to author, and they are the heart of the destruction phase.

**FBX into Three.js.** Convert the FBX set to `.glb` with a scripted, repeatable, checked-in conversion step, so a future art update is one command and not an afternoon. Do not hand-convert. Do not modify the FBX originals. Verify after conversion that dimensions and pivots still match the manifest table above, piece by piece, and put that check in the test suite. A conversion that silently shifts a pivot turns every level into a leaning tower.

### What the kit does not cover

Measured: `Art\Balls\`, `Art\Environment\`, `Art\Platforms\`, `Art\UI\`, `Audio\`, `Reference\Structures\` and `Data\StructuralPieces\` all contain nothing but a `.gitkeep`. **There are no balls, no environment, no UI art and no audio.** Fill those from permissively licensed CC0 packs (Kenney and equivalents), or from primitives where a primitive reads better than a mismatched asset.

Every asset that ships gets a manifest row: file, source, author, license, where used. No asset ships without a license you read.

### The governance pack

`H:\Marcelo\Programming\Games\Governance`, v1.11 as last recorded. Read it. Two things before you quote it: its policy prose is real and specific, but its document headers still carry unreplaced placeholder tokens (`Owner: <OWNER>`, `Version: <VERSION>`), so do not quote a document header as fact. And adoption is per repo and opt-in: a repo has adopted the pack when it carries a root `VERSION` file, an `Operations/` folder and a `System/Documentation/` folder.

**Impact Theory adopts none of those.** The eleven rules in STANDARDS below bind this build anyway, because the owner says they do. Everything else in the pack is advisory here. Record that determination in `docs/DECISIONS.md` so the next session does not re-litigate it.

---

## DO NOT INHERIT

Defects confirmed by measurement, or on record in the owner's other projects. You are starting clean, so these are patterns to avoid.

1. **A completed art pass that was never committed, and a commit message claiming it was.** Measured: `Games\Impact` has a v0.8 commit titled "V2 recovery checkpoint: protect the materialized block library" and another titled "feat(assets): bring the recovered V2 materialized block library under version control". `git ls-files` in that repository returns **zero** files under `Assets/Art/Blocks/MaterialVariants`, and the directory is not on its disk. **The commit messages are false.** Do not write a commit message describing an outcome you did not verify after the fact.
2. **A "source of truth" document seven versions stale.** `Games\Impact\PROJECT_STATE.md` opens with "Read this file first" and states version `v0.7`, dated 2026-08-26, while that repository's git log is at `v0.14`. **A status document in this repo is updated in the same commit as the thing it describes, or it is not written.**
3. **A Unity Assets tree with no `ProjectSettings` or `Packages`.** Measured, in both Impact folders. Whatever produced them stopped before making them openable. **Do not ship a project that cannot be opened and run by the command in its own README.**
4. **Two documents mandating two different version formats.** In the owner's Space Invaders project, the governance doc says `vX.Y` and the project-root guide says `MAJOR.MINOR.0+BUILD`, both presented as authoritative. **This repo states its version scheme in exactly one file and every other file points at that file.**
5. **A documented workflow pointing at a script that is not where it says.** That project's guide tells the reader to run `.\scripts\version-bump.ps1`; there is no `scripts\` folder and the real script is one level up under a reversed name. **Every command you write into a document, you run yourself first.**
6. **A duplicate working tree pointing at another project's remote.** Covered in the Workspace block. **One working tree, one remote, checked before every push.**
7. **Phases simultaneously "in progress".** In the owner's abandoned Flutter project several changelog entries end "validation status: pending" and several phases are open at once. **A phase in `docs/PROGRESS.md` is done, partial or skipped. There is no fourth state.**
8. **Example text read as fact.** A previous run copied the sample answers printed under a question in a *blank* questionnaire and wrote them into a shipped repo as the owner's son's real preferences. **Check the source before repeating it. If a value came from a summary rather than from the file, mark it `UNVERIFIED`.**

---

## TARGET

### The game

**Impact Theory.** A physics demolition game. A cannon at the near edge of a flat playfield fires balls at a structure built from the fifteen-piece block kit standing on support pieces. The structure is a real rigid-body assembly, so it leans, buckles and falls the way its geometry says it should. Clearing the structure clears the level.

**Original identity only.** The reference clip describes the target; it does not license its vocabulary. Do not use the reference game's name, art, sounds, icons, UI copy or level layouts. Piece names come from the manifest. Level names, colours and copy are yours to invent.

### Stack

- **Three.js** for rendering.
- **Rapier 3D** for physics, via `@dimforge/rapier3d-compat` so the WASM does not fight the bundler. Verify the current package name and init pattern against the official docs before writing against it. Do not write Rapier API calls from memory.
- **Vite** for dev server and build. **Vitest** for unit tests. **Playwright** for smoke tests and screenshots.
- Plain JavaScript or TypeScript, your call, decided once in phase 1 and logged in `docs/DECISIONS.md`. Do not switch later.
- No game engine, no React, no state library, no CSS framework. This is a small canvas game with a thin DOM overlay.

**Research requirement.** Any version number, API signature, package name, config key or license term you put in code or docs comes from current official documentation you opened, with the source URL beside it in a comment or in `docs/DECISIONS.md`. Anything you could not confirm gets marked `UNVERIFIED` with the exact question that would settle it.

### Target platform

Primary target is **the owner's son's phone, in a mobile browser, in portrait**, opened from a link. That is the platform the build is judged on. Desktop browser with a mouse must also work, because that is where you test.

Ship it to **GitHub Pages** from the repo via a GitHub Actions workflow, so the link exists and the owner can hand it to his son without installing anything. If Pages cannot be enabled from an API you can reach, build the deploy workflow anyway, commit it, and say in the report exactly which switch the owner has to flip in the repo settings.

### Camera and controls

- Fixed camera behind and slightly above the cannon, looking up-screen along the playfield. Portrait is the design target; the layout must survive a desktop landscape window without breaking.
- **Aim by dragging anywhere on the screen.** Drag controls cannon yaw and pitch, clamped so the barrel cannot point at the sky or at the player.
- **Fire on tap or release**, and support hold-to-stream at a capped rate, because the clip clearly has several balls in flight at once. Fire rate is a named constant, tunable in one place.
- A thin aim indicator so a child can tell where the barrel points. Not a full trajectory prediction line; that removes the game.
- Mouse maps to the same handlers. No separate desktop control path.

### Blocks, materials and destruction

- **Physics material families**, matching the V2 art direction: Wood, Brick, Stone, Concrete, Steel, Painted Steel, Rubber. Each carries density, restitution, friction and hit points as named constants with units and a reason in the comment. Each of the fifteen pieces gets its default family from the list above.
- **Colliders derive from the manifest dimensions**, not from eyeballing the mesh. Boxes for the box-shaped pieces, a cylinder for `S01_ROUND_COLUMN` and `A04_ROLLER`, convex hulls or compound shapes for `S05_ARCH`, `A01`, `A02`, `A03` and `A05`. Respect the two geometric-center pivots; getting that wrong sinks pieces into the ground and will look like a physics bug.
- **A dedicated support role.** `S03_WIDE_FOOTING`, `S01` and `S02` can be authored as the supports the structure stands on, as in the clip. Knocking a support out should drop what is above it. That behavior comes from the physics, not from a scripted trigger.
- Pieces accumulate damage from **impact energy, not hit count**. A graze is not the same event as a square hit.
- **When a piece's hit points reach zero it fractures**: removed and replaced by a small number of smaller rigid bodies inheriting its velocity, plus a dust burst. Fragments count against the body budget from the spike, and must despawn on a timer or when at rest and out of view.
- Level clears when every non-support piece is destroyed or has come to rest below a stated height threshold. That rule lives in one function and one constant.

### Levels and progression

- **30 hand-designed levels**, defined as **data files (JSON), not code.** A level file lists piece IDs from the manifest, placements, material overrides, and the level's par. Write a validator that fails the test suite on a malformed level file or on a piece ID not in the manifest.
- Level select showing which levels are open and which are still locked, progress saved to `localStorage` behind a **versioned save schema with a migration path**. A save written by v1.0.0 must still load after you change the schema, or it must migrate. Test that.
- **Endless mode**: seeded procedural structures emitting the exact same level schema. If endless mode needs its own format, the format is wrong.

### Scoring

- Points per piece destroyed, weighted by material family.
- Combo multiplier for pieces destroyed in quick succession from one shot's chain reaction.
- Three-star rating per level on balls remaining against par.
- Score, stars and best-per-level persist in the save.

### Difficulty

Two modes, chosen in settings, changeable any time, stored in the save.

- **Easy.** For a young child, roughly four to seven. Unlimited balls. No fail state, ever. Larger ball radius, more forgiving physics, generous star thresholds. Something visibly satisfying happens on every shot even if nothing falls.
- **Normal.** Roughly eight to twelve. Balls limited by the level's par, aim matters, star thresholds reward efficiency, a level can be failed and retried.

Difficulty changes tuning constants only. It must not fork the game logic into two code paths.

### Audio

Impact thuds scaled by impact energy and by material family, collapse rumble, cannon fire, fracture crack, level clear sting, and a light background track that can be muted. CC0 sources only, every file in the manifest with its license. Mute persists in the save.

### The single hardest requirement

**Destruction that feels good.** Its own phase, and the phase most likely to be quietly faked.

It is not done when blocks fall over. It is done when a ball hitting a stone piece at speed produces: a weighty impact sound scaled to the energy, a short camera shake scaled to the energy, visible dust and debris, momentum transferred through the stack so a hit at the base drops the top, and a collapse that looks like mass moving rather than boxes losing their constraints.

**The cheap fakes named in advance, so that reporting one as done is a lie rather than a misunderstanding:** pieces that despawn on contact instead of collapsing; a canned collapse animation triggered by a hit; default physics parameters with no tuning pass and no impact feedback; particles standing in for structural failure; and a score popup used to make a limp collapse read as a successful hit.

---

## THE EARLY DECISION

**How many dynamic rigid bodies hold a playable frame rate on the target phone?** Every level layout, every fracture fragment count and every particle budget depends on it, and discovering it late means re-authoring thirty levels.

**Settle it with a timeboxed spike in phase 3, by measurement, not by reasoning.**

Build the smallest scene that proves it: a stack of N pieces from the real converted kit, dropped, with the real camera, the real materials and the real fixed timestep. Measure sustained frame rate over ten seconds after the collapse starts. Step N up until it breaks.

- Criterion: the body budget is the largest N holding **at least 45 fps sustained in a mobile browser**, minus a 30 percent headroom margin for fragments, particles and audio.
- If you cannot test on real hardware, test in a mobile-emulated context with CPU throttling, say plainly in the report that the number came from an emulator, and mark it `UNVERIFIED` with the resolving question.
- Settle in the same spike: fixed timestep, solver substep count, sleeping thresholds, and whether fragments use simplified colliders.

**Log the result in `docs/DECISIONS.md` with the measured numbers, then do not revisit it.** If a later phase makes you want to reopen it, write the reason in the report and keep building. Second-guessing this at 4am is how a night ends with two half-finished level sets.

---

## STANDARDS

The owner's rules. They bind this build. Where a rule and anything else here conflict, report the conflict in the final report rather than silently picking a side.

1. **No false green light.** Do not report PASS, validated, ready, complete or green light on the strength of a dependency install, a linter, a test suite or a successful build. Runtime validation means the game launched and you looked at it. If you did not do that, write this sentence exactly: `Build validation passed, but runtime startup validation was not performed. This is not a full green light.`
2. **No assumptions.** Write `Unknown` or `Not validated` where evidence is missing. Never assume runtime success, asset validity, path correctness, version status or owner acceptance.
3. **Visual QA gate.** Any change to rendering, models, animation or gameplay pathing gets four Playwright screenshots: portrait phone viewport, resized desktop viewport, debug overlay on, debug overlay off. Each judged pass or fail against a stated acceptance criterion. On this game that fires on nearly every change, which is the point.
4. **One coordinate system.** All gameplay authoring in Structural Units, matching the block kit. Any screen-space arithmetic, meaning touch-to-aim raycasts, HUD anchoring and the debug overlay, goes through a **single** projection helper, recalculated on resize. No handler does its own arithmetic. This is the rule most often broken by a touch handler, and here the touch handler is the whole control scheme.
5. **Centralise tunables.** No repeated inline literals. Named constant blocks with units in the comment. File order: header, imports, constants, types, public functions, private helpers.
6. **Clean tree first.** Start from a clean `git status --short`. Classify every dirty file before continuing.
7. **Commit separation.** Keep data, logic, UI, documentation and version-bump commits distinct. Closeout sequence: code and docs and tests commit, then the version bump commit, then push.
8. **Temporary artifacts go to `.agent_temp/`** (`screenshots`, `diagnostics`, `scratch`), gitignored. Never into `assets/`, `docs/` or `_source/`.
9. **Original identity only.** No protected commercial names, characters, art, icons, sounds or copied level layouts.
10. **Authority order** when instructions conflict: this document, then the governance pack, then module docs. Report conflicts, do not bypass them.
11. **Smallest safe change.** Avoid broad rewrites.

### Documentation standard

- **README** is the front door: what the game is in three sentences, current version and where the scheme is defined, requirements, copy-pasteable install and run commands **you personally ran**, controls, project structure one line per top-level folder, how to run the tests, where the policies live, asset credits naming which assets are the owner's own work and which are not, and a link into the deeper docs. Plain and factual. No marketing copy, no emoji, never the stock template Vite generated.
- **Agent router file** at the repo root (`CLAUDE.md`), under a page: real absolute paths, current version, branch, where the docs and policies are, and the two rules most likely to be violated here. A pointer file, not a database.
- **Code comments** for a competent developer who has never seen this project. Every file opens with a header saying what it owns and what it must not own. Every public function says what it does, what it assumes, what it returns and what breaks if it is called out of order. Every tuning constant carries its value, its reason and its source. Do not narrate the obvious.
- **All user-facing text** spell-checked and grammatical: every label, tooltip, empty state and error message.
- Writing rules for every document you produce: no em dashes, use commas or parentheses. No emoji in shipped prose. Avoid the words *delve*, *leverage*, *robust*, *seamless*, *unlock*, *dive into*, *game-changer*, and the phrases *it is worth noting* and *at the end of the day*.

---

## GIT AND VERSIONING

- **Repo path:** `H:\Marcelo\Programming\Games\Impact Theory`. **Remote:** `https://github.com/NCD01/Impact-_Theory.git`, **with the underscore**. **Branch:** `main`. The remote is empty. The similarly named `https://github.com/NCD01/Impact-Theory.git`, without the underscore, belongs to the separate live project in `Games\Impact` and **must never receive a push from here**.
- **Git repository from minute one.** `git init` before any other file is written, verified with the full absolute path. Add the remote and verify with `git remote -v`, not from memory of what you typed. Then the asset backup commit described in the Workspace block, before any gameplay code.
- **`.gitignore` before the first commit.** `node_modules`, `dist`, `.agent_temp`, IDE folders, logs, OS junk, `Thumbs.db`. Nothing generated is ever tracked. A `.gitignore` added after the first commit means the junk is already in history.
- **Full repository file set exists and is accurate before the first push.** Every one of these, written by you, none a stub and none a framework's stock template:

  | File | What it holds |
  |---|---|
  | `README.md` | The front door. Standard above. |
  | `CHANGELOG.md` | Prepended, newest first, entry format below. |
  | `LICENSE` | MIT unless the owner has said otherwise. |
  | `CONTRIBUTING.md` | How to set up, branch, commit, test and open a change. |
  | `.gitignore` | Written before the first commit. |
  | `.gitattributes` | Line endings pinned, so a Windows master and a Linux CI runner do not fight. |
  | `CLAUDE.md` | Agent router file, under a page, pointers only. |
  | `docs/VERSIONING.md` | The one file that states the version scheme. |
  | `docs/DECISIONS.md` | Decision log. Decision, alternatives, rationale, rollback. |
  | `docs/PROGRESS.md` | One line per phase, appended as you go. |
  | `docs/ARCHITECTURE.md` | Module boundaries. What each folder owns and what it must not own. |
  | `docs/GAMEPLAY.md` | Mechanics, scoring model, star thresholds, difficulty tables. |
  | `docs/LEVEL_FORMAT.md` | The level JSON schema, field by field, with a worked example. |
  | `docs/BLOCK_KIT.md` | The fifteen pieces, their dimensions, pivots, material families, collider shapes and physics constants. |
  | `docs/ASSET_MANIFEST.md` | Every shipped asset: file, source, author, license, where used. |
  | `docs/TESTING.md` | How to run each suite and what each one covers. |
  | `docs/ARCHIVE.md` | What is in `_source/unity-checkpoint`, where the same code lives under version control in `Games\Impact`, and how to move it back. |
  | `.github/workflows/` | Build and test on push, plus the Pages deploy workflow. |
  | `HANDOFF.md` | Written last, in the final phase. Format in the OUTPUT CONTRACT below. |

  A documentation file describing something not built yet says so in one line. It does not describe it in the future tense as though it exists.

### Commit cadence

**Commit often. The owner asked for this specifically, and it is what an unattended run is worst at.**

- **A commit per unit of working change**, not per phase. A new module, a wired control, a tuned constant set, a fixed bug, a written document: each is its own commit, green, with its own changelog entry and its own version bump.
- **Every phase produces multiple commits.** A phase landing as one commit cannot be reviewed, bisected or partially reverted. If you reach the end of a phase with one commit, you batched, and batching is the failure.
- **Push every commit.** Do not accumulate a phase of local history and push at the boundary. Bump, stage, commit, push, in the same breath. A bumped version sitting uncommitted is drift, and an unpushed commit is work the owner cannot see.
- **Never commit with a bare subject.** Every commit carries the full message contract below. `updates`, `WIP`, `fixes` and `progress` are not commit messages.
- **Documentation commits count.** A doc correction is a PATCH bump, a changelog entry and a push, exactly like a code fix.

### The rest of the discipline

- **Version scheme:** `MAJOR.MINOR.PATCH+BUILD`, starting at **`1.0.0+1`**. Write the rule into `docs/VERSIONING.md` and point every other file at that one file. PATCH for a fix, a doc correction or a no-behavior refactor. MINOR for a feature, an asset set or a screen. MAJOR for a save-format break. BUILD increments on every version change without exception. **One version number, true everywhere**: package manifest, versioning doc, README, changelog head, and the in-game settings or about screen all agree.
  - The governance pack mandates `vX.Y` with no patch digit and its `bump-version.ps1` throws on anything else. This repo has not adopted the pack, and a three-part scheme is what the owner's other live projects run. **Record that conflict and this resolution in `docs/DECISIONS.md` and move on.** Do not renumber anything to satisfy the pack, and do not run its script against this repo.
- **Changelog is prepended.** Newest at the top. Every entry carries version, date, author, type (Feature, Fix, Refactor, Documentation, Logging, Structural, Asset, Test), reason, the list of changes, and a **Validation Evidence** line saying what you actually ran or looked at.
- **The commit ritual, every commit, in order, no steps merged and none skipped:**
  1. Linter clean and tests green. If a change cannot go green within reasonable effort, revert it, commit the last green state, and record the attempt.
  2. Bump the version.
  3. Write the changelog entry. It ships in this commit, not the next one.
  4. Stage.
  5. Commit with a documented message.
  6. Push.
- **Commit message contract:**

  ```
  <type>: <what changed, in plain language> - v<version>

  <why it changed, one or two sentences>
  <what was validated, and how>
  ```

  `Fix: S05_ARCH no longer sinks through the footing at high impact - v1.2.1+14` is a commit message. `updates` is not.
- **Decision log** for anything you would resent reverse-engineering in six months: decision, alternatives considered, rationale, rollback option. Once recorded, do not silently reverse it.
- **If the remote cannot be reached:** do not stop and do not loop on retries. Keep committing locally, record the reason, retry once at each phase boundary, and state at the end how many commits reached the remote and how many did not. Local history is never lost, so this is an inconvenience, not an emergency.
- **Never `push --force`. Never rewrite published history. Never `git reset --hard` over uncommitted work. Never run a git command inside a read-only reference location.**

---

## AUTONOMY CONTRACT

**The owner's governance pack carries a Five-Minute Stop Rule** (`AGENT_BASELINE.md`), requiring an agent that cannot resolve an issue after about five minutes of focused debugging to stop and wait for direction.

**Marcelo De Freitas has suspended that rule for this run only.** It is a good rule for an attended session and incompatible with an unattended one, where nobody is awake to give direction. The suspension is scoped to this build and to no other session. It is replaced by the four clauses below, and clause 2 does the stop rule's real job here.

1. **Log and continue.** On a blocker, write it down with the exact question that would resolve it, choose the most reversible option available, and keep building. A blocker recorded with its resolving question is useful. A night spent waiting is not.
2. **Three-strike rule.** The same approach failing three times means change the approach, not the parameters. Re-running a failing command with a tweaked argument is not progress and it is the single largest way an unattended night gets wasted.
3. **Never leave the tree broken.** Green before every commit. If a change cannot go green, revert it, commit the last green state, log the attempt, and move to the next phase. A finished night with one phase skipped and a working build beats every phase attempted and a red tree.
4. **Scope fence. Do not build any of these**, however much time is left: multiplayer, leaderboards, accounts, any backend or server, ads, in-app purchases, analytics, a level editor, a cosmetics or skins shop, achievements, cloud saves, native app packaging, more than 30 hand-designed levels, any new 3D modelling beyond the existing kit plus primitives, and any port or revival of the archived C#.

---

## PHASES

Each phase ends with commits, pushes, and a one-line status appended to `docs/PROGRESS.md`, so a crashed session resumes by reading that file instead of guessing.

**Read the dependency notes. They are not the same as the ordering.** A phase run before the phase that invalidates its input produces numbers that read like measurements and are noise.

**Phase 0: Ground truth and toolchain.** Read the target folder and everything it points at. Read the block manifests and both block READMEs. Read the governance pack. Prove the toolchain by running it: node version, npm install, Vite dev server up, a browser opening the page. A toolchain assumed to work is the most expensive assumption in a long run.

**Phase 1: Repo, asset backup, docs, first push.** `git init`, remote, `.gitignore`, `.gitattributes`. **Commit and push the entire existing `Assets\` tree verbatim, first, before anything else**, because the V2 materialized block library in it exists nowhere else and is under no version control anywhere. Verify that push by fetching and diffing against the remote, not by assuming it. Then `git mv` the Unity-only parts into `_source\unity-checkpoint\` as described in the Workspace block. Then the full documentation set, version `1.0.0+1`, and the GitHub Actions workflows.

**Phase 2: Block kit pipeline.** Scripted FBX to glTF conversion, checked in and repeatable. Loader. A test asserting every converted piece matches the manifest table on dimensions and pivot. `docs/BLOCK_KIT.md` written from the manifest, not from memory.
> **Blocks phase 3.** The spike must run on the real converted meshes and colliders. A budget measured on placeholder cubes is a budget for a game you are not building.

**Phase 3: The body budget spike.** As specified in THE EARLY DECISION. Ends with measured numbers in `docs/DECISIONS.md`.
> **Blocks phase 6.** Do not author a single level until the budget is logged.

**Phase 4: Vertical slice.** Cannon, drag-to-aim, fire, one hand-built structure standing on supports, real collapse, level clear detection. Ugly is fine. Playable end to end, and running in a phone-sized viewport.

**Phase 5: Destruction feel.** The hardest phase. Impact energy model, per-family hit points, fracture into fragments, dust and debris, camera shake scaled to energy, impact audio scaled to energy, momentum transfer through the stack, supports that actually drop what stands on them. Re-read the "single hardest requirement" section and its list of cheap fakes before calling this done, and state in `docs/PROGRESS.md` which of those fakes you checked you had not shipped.
> **Blocks phases 7 and 10.** Scoring cannot be tuned before this, because this phase decides what a "piece destroyed" event is. Environment and UI art cannot be sourced before this, because this phase sets the fragment counts and the particle budget the art has to live within.

**Phase 6: Level format and 30 levels.** JSON schema keyed to manifest piece IDs, validator, loader, 30 hand-designed levels with rising difficulty, level select showing open and locked levels, versioned save with migration. Depends on phase 3.

**Phase 7: Scoring, stars, combos.** Depends on phase 5. Star thresholds tuned by playing the levels, not by picking round numbers.

**Phase 8: Difficulty modes.** Easy and Normal as tuning constant sets, one code path, stored in the save.

**Phase 9: Endless mode.** Seeded generator emitting the phase 6 schema. Depends on phase 6.

**Phase 10: Remaining art and environment.** Balls, ground, backdrop, UI. CC0 or primitives. Never modify an original. Register every asset, then **verify each one actually loads at runtime**, because registered but never loaded is the most common way an asset phase reports success while shipping nothing. Write `docs/ASSET_MANIFEST.md` covering everything shipped, including assets you chose not to use and why they are worth keeping. Depends on phase 5.

**Phase 11: Audio.** Impact per material family, collapse, fire, fracture, clear sting, background track, mute that persists.

**Phase 12: UI and menus.** Title, level select, in-level HUD (score, balls remaining, level, pause), pause, settings, results screen with stars. Portrait first, must not break in a desktop landscape window.

**Phase 13: Tests.** Non-optional. Vitest for the scoring model, star thresholds, save migration, level schema validation, block manifest conformance, and a deterministic physics test rig with a fixed seed and fixed timestep asserting a known structure collapses. Playwright smoke: page boots, level loads, a shot fires, no console errors, four screenshot classes captured.

**Phase 14: Documentation and deploy.** README accurate against the build as it now stands, every command personally run. CHANGELOG current. Router file current. Pages deploy live, or the exact manual switch named.

**Phase 15: Final verification and the report.**

**If time runs short**, sacrifice phase 12 polish first, then phase 9 endless mode. **Never sacrifice phase 13 or phase 14.** A game with no tests and no accurate README is not a deliverable, it is a folder.

---

## OUTPUT CONTRACT

Write `HANDOFF.md` at the repo root and commit it. The owner reads it in five minutes. Do not compress it into a highlight reel.

1. **Bottom line, two sentences.** Is it playable, and what needs attention first.
2. **How to run it.** The URL if Pages deployed, the local commands otherwise. The state of every location and of the remote.
3. **The asset backup.** Confirm the existing `Assets\` tree is committed and pushed, the commit hash, its total size, and anything excluded or moved to Git LFS with the reason. State explicitly whether the V2 materialized block library is now on the remote. This is the second thing the owner will check.
4. **The early decision.** The body budget you measured, the evidence, the hardware or emulator it came from, and what reversing it would cost now.
5. **Every phase, one line each, marked done, partial or skipped.** All sixteen. Never omit a phase because it was skipped.
6. **Decisions made alone.** Every safe default you took, its alternative, and how hard it is to reverse. **This is the section the owner scrutinizes hardest. Do not compress it.**
7. **Block kit conformance.** Which of the fifteen pieces survived conversion with correct dimensions and pivots, and which did not.
8. **Fidelity ledger.** Where the game differs from the reference clip and why, honest about approximations.
9. **Unverified values.** Every value marked `UNVERIFIED`, each paired with the exact question that would settle it.
10. **What is broken or missing.** Severity weighted by consequence, not by how alarming the bug reads.
11. **Open questions**, each paired with the exact information that would resolve it. **A short section here is not a sign of a good night.** A gap reported is useful; a gap absorbed into a confident summary is a lie.
12. **The next three moves, in order.**

Close the report with this, and mean it: every claim in this document is something I verified by running or reading, not something I expected to be true because I wrote the code for it.

---

## VERIFICATION

Confirm each by doing it. Note anything that fails rather than dropping it.

- [ ] Linter clean on the final commit.
- [ ] Tests green on the final commit.
- [ ] The game launches in a browser and is playable start to finish: title, level select, play a level, clear it, see stars, return, play the next one.
- [ ] Playable in a portrait phone viewport with touch input, which is the platform it is judged on.
- [ ] All fifteen converted pieces load and match the manifest on dimensions and pivot.
- [ ] Every asset loads at runtime. Verified by watching the network panel or a load-count assertion, not by reading the manifest.
- [ ] Four screenshot classes captured for the final build and stored in `.agent_temp/screenshots`.
- [ ] The full original `Assets\` tree committed and pushed, V2 library included, verified by fetching and diffing against the remote.
- [ ] `_source/unity-checkpoint` moved with `git mv`, history intact, nothing deleted.
- [ ] No unwaived magic literals in gameplay code.
- [ ] File headers and constant comments present.
- [ ] README accurate, every command in it personally run.
- [ ] One version number, agreeing across every file that states one.
- [ ] Changelog head matches the current version.
- [ ] `git status` clean, local HEAD matches the remote.
- [ ] `H:\Marcelo\Programming\Games\Impact` untouched: `git -C` that path reports a clean tree and its remote is still the non-underscore URL. Verify, do not assume.
- [ ] `docs/PROGRESS.md` has a line for every phase.

---

## THE TASK

Start at Phase 0. Read the folder before you write anything. Prove the toolchain by running it. **Get the existing `Assets\` tree committed and pushed inside the first hour**, because the V2 materialized block library in it exists nowhere else and is under no version control anywhere. Then work the phases in order, honoring the dependency notes, committing and pushing constantly.

Build **Impact Theory** so that a child can open a link on a phone and knock a tower down, and so that the owner can read your report in five minutes and trust every line of it.

**Do not ask a question. Do not stop. Build the game.**
