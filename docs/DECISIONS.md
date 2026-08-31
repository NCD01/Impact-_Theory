# Decision log

Decisions taken during this build that a future reader would otherwise have to
reverse engineer. Each records what was decided, what else was considered, why, and
how to undo it. Once recorded, a decision is not silently reversed.

Newest at the bottom, so the numbering reads in the order the decisions were made.

---

## D-001: The brief's `Games\Impact` folder does not exist. It is called `IT`.

**Decided:** 2026-08-30, phase 0.

**Finding.** The build brief names `H:\Marcelo\Programming\Games\Impact` as a
separate live project to be treated as read only. Listing
`H:\Marcelo\Programming\Games\` shows no folder of that name. The folder holding that
project is `H:\Marcelo\Programming\Games\IT`.

Confirmed it is the right project by reading it: its git remote is
`https://github.com/NCD01/Impact-Theory.git`, the form without the underscore, it
carries `VERSION`, `Operations/`, `System/`, `Tests/`, `scripts/` and `Docs/`, and its
git log runs to `v0.14`. Every identifying detail in the brief matches except the
folder name.

**Decision.** Treat `Games\IT` as the read only project the brief meant. No git
command that writes was run inside it. The read only inspections performed were
`git remote -v`, `git status --short`, `git log`, `git ls-files`, `git ls-tree` and
`git rev-parse`. No fetch was run there, because a fetch writes to `.git`.

**Alternative considered.** Treating the brief as authoritative and reporting the
project as missing. Rejected: the folder is plainly there under a different name, and
the hazard the brief is guarding against, pushing into the wrong repository, is real
regardless of what the folder is called.

**Rollback.** None needed. Nothing was changed.

---

## D-002: Impact Theory does not adopt the governance pack, but the eleven standards bind it.

**Decided:** 2026-08-30, phase 0.

The governance pack at `H:\Marcelo\Programming\Games\Governance` is adopted per
repository and opt in. A repository has adopted it when it carries a root `VERSION`
file, an `Operations/` folder and a `System/Documentation/` folder. This repository
carries none of those and does not adopt the pack.

The eleven standards quoted in the build brief bind this build anyway, because the
owner says they do. Everything else in the pack is advisory here.

**Consequence for versioning.** The pack mandates a two part `vX.Y` scheme and its
`bump-version.ps1` rejects anything else. This repository uses
`MAJOR.MINOR.PATCH+BUILD`, which is what the owner's other active projects run. The
conflict is recorded here as the brief instructed, nothing is renumbered to satisfy
the pack, and the pack's script is never run against this repository.

**Rollback.** Adopting the pack later means adding `VERSION`, `Operations/` and
`System/Documentation/`, and reconciling the version scheme. Nothing here blocks that.

---

## D-003: The reference clip is reference, not a licence.

**Decided:** 2026-08-30, phase 0.

The clip in `Reference/` is another studio's commercial game. It describes the target
and licenses nothing. No name, art, sound, icon, interface text or level layout from
it appears in this project. Piece names come from `block_asset_manifest.json`. Level
names, colours and copy are original to this build.

**Rollback.** Not applicable. This is a constraint, not a technique.

---

## D-004: Plain JavaScript with JSDoc, not TypeScript.

**Decided:** 2026-08-30, phase 1. Settled once, not revisited.

**Decision.** The game is written in plain JavaScript modules. Types are documented
with JSDoc comments where a signature is not obvious. Vitest runs the unit tests.

**Alternatives considered.** TypeScript, which the brief left to this build's
judgement. TypeScript catches misspelled properties at build time, which has real
value in a session with nobody available to debug a runtime error.

**Rationale.** It was rejected for this run because the failure mode it introduces is
worse here than the one it prevents. Rapier is loaded through a WebAssembly
compatibility wrapper and Three.js geometry code involves a lot of structural typing;
both tend to produce type errors that are resolved with casts rather than by finding
real bugs. A type error that blocks a build in an unattended session costs the whole
remaining night. ESLint plus the unit test suite covers the same class of typo at
lower risk.

**Rollback.** Moderate cost. Vite compiles TypeScript without extra configuration, so
migration is renaming files to `.ts` and adding annotations file by file. The code is
written as ES modules with explicit imports, which keeps that path open.

---

## D-005: node_modules lives on the network share, because a junction cannot be made there.

**Decided:** 2026-08-30, phase 1.

The master repository is on an SMB network share, `\NCD-NAS01\homes\...`, mapped to
`H:`. Staging 476 files there took 32 seconds, so disk speed is a real cost.

**First approach, failed.** Point `node_modules` at local disk with a directory
junction, keeping one working tree while moving the heavy input and output to `C:`.
Windows cannot create a reparse point on an SMB share. The attempt returned
`The file or directory is not a reparse point`.

**Decision.** Install into the share and measure, rather than reasoning about it. The
alternative, a second working copy on `C:`, is the exact arrangement that has already
cost this owner once when a duplicate tree was found pointing at another project's
remote. One working tree is worth some slowness.

**Rollback.** If the share proves unworkable the fallback is a clone on `C:` used only
for building and testing, with source flowing one way from `H:` and nothing but
results flowing back. That is not in use.

---

## D-006: The body budget is 120 concurrent dynamic bodies measured, 84 after headroom, 45 pieces per level.

**Decided:** 2026-08-30, phase 3. Settled by measurement. Not to be reopened.

### What was measured

A wall built from the real converted kit, with the real colliders, the real materials,
the real fixed timestep and the real camera, was settled, then knocked down with eight
shots, then sampled every 250 ms for eleven seconds. Frame time and live body count were
recorded together at every sample, and samples from six runs at different piece counts
were pooled and bucketed by the number of bodies actually live at that moment. Six runs,
264 samples.

Measuring frame rate against live body count rather than against the piece count a level
started with matters, because a collapse destroys pieces and spawns and despawns
fragments continuously. The first two attempts at this measurement both failed for that
reason and are recorded below, because the way they failed is the interesting part.

| Live dynamic bodies | Samples | Mean fps | p95 worst fps |
|---|---|---|---|
| 0 to 24 | 14 | 60.0 | 60.0 |
| 25 to 49 | 48 | 58.8 | 53.3 |
| 50 to 74 | 54 | 59.0 | 52.5 |
| 75 to 99 | 51 | 55.9 | 46.7 |
| 100 to 124 | 31 | 52.3 | 41.2 |
| 125 to 149 | 27 | 43.8 | 31.8 |
| 150 to 199 | 24 | 32.4 | 20.0 |
| 200 to 299 | 15 | 19.6 | 12.6 |

### The decision

- **Measured ceiling: about 120 concurrent dynamic bodies.** That is where sustained mean
  frame rate crosses the 45 fps criterion: 52.3 fps at 100 to 124 bodies, 43.8 at 125 to
  149.
- **Budget after the 30 percent headroom the brief requires: 84 concurrent bodies.**
- **Level authoring cap: 45 pieces**, written into `LEVEL.MAX_PIECES` and enforced by the
  level validator. A 40 piece wall was measured to peak at 55 concurrent bodies mid
  collapse, so 45 pieces stays inside the budget with the fragment and ball caps applied.
- **Fragment cap lowered from 46 to 36**, so the worst instant of a full collapse with 20
  balls in flight lands near 100 bodies rather than past the ceiling.
- **Fixed timestep 1/60 s**, at most 3 steps per rendered frame.
- **Fragments use simplified box colliders** regardless of the shape they came from. A
  compound collider per chip is the fastest way to spend the whole budget on rubble.
- **Solver iterations left at Rapier's default of 4.** Scope note: the spike varied body
  count only, so there is no measurement here saying 4 beats 8. Stacks of the size this
  game builds stand without visible sinking at 4.

### UNVERIFIED, and the question that would settle it

**This number did not come from the target phone.** It came from headless Chromium in
Chromium's own mobile emulation at a 390 x 844 viewport and device pixel ratio 2, on an
Intel Iris Xe integrated GPU, with CDP CPU throttling set to 4x to stand in for a phone
processor. The renderer string recorded with the measurement is
`ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
Confirmed not to be software rendering: without the GPU flags the same harness reports
SwiftShader, and every number under SwiftShader was meaningless.

**Resolving question:** on the son's actual phone, opening the deployed link with
`?stress=120`, does the frame counter hold at or above 45 fps through the collapse? If it
does not, lower `LEVEL.MAX_PIECES` and `DESTRUCTION.MAX_FRAGMENTS` proportionally. Every
level is a data file, so that change does not touch code.

Reproduce with a dev server running: `node scripts/spike-body-budget.mjs`. Raw output is
in `docs/body-budget-spike.json`.

### Two failed measurements, recorded so they are not repeated

1. **First attempt reported a flat 60 fps at every piece count from 20 to 130.** It
   sampled the debug state once, at the end of a ten second window. By then the wall had
   collapsed, every piece had fractured and every fragment had despawned, so it was
   measuring an empty scene. The tell was `bodiesPeak: 0` in every row, which is the kind
   of number that has to be read rather than skimmed past.
2. **Second attempt reported nothing at all above 100 bodies.** It filtered to samples
   where the body count was at least 60 percent of the run's peak, but the peak occurs at
   the start and the count falls throughout a collapse, so almost every sample was
   filtered out. Replaced by bucketing all samples by live body count, which uses all the
   data and answers the question directly.

Both failures had the same root cause: a structure that destroyed itself. That turned out
to be a real defect and is decision D-007.

---

## D-007: Hit points were recalibrated against measured impact energies, not guessed.

**Decided:** 2026-08-30, phase 3, while trying to run the body budget spike.

**The defect.** Every structure vaporised. A forty piece wall went from standing to
almost nothing within about a second of being hit, and the vertical slice's eleven piece
structure lost all eleven pieces including its steel supports. That is one of the cheap
fakes the brief names: pieces effectively despawning on contact rather than collapsing.

**Why.** The per family hit points were guessed, at 900 J for wood up to 4200 J for
steel, without measuring what an impact in this game is actually worth.

**What was measured.** Every impact the simulation reported was logged, first with the
structure standing and untouched, then through six shots and the collapse.

| Condition | Impacts | Distribution |
|---|---|---|
| Standing, no shots | 4613 | 100 percent under 10 J, largest 5 J |
| Six shots and collapse | 8144 | 92.6 percent under 10 J, p99 417 J, 32 above 2000 J, largest 54057 J |

So a square ball hit is worth roughly 5000 to 50000 J, a glancing hit a few hundred, and
a piece settling against its neighbour under 10 J. The guessed hit points were one to two
orders of magnitude below a real hit, so everything died to everything.

**The change.** Hit points reset against that scale: wood 8000, brick 18000, concrete
24000, stone 30000, painted steel 40000, rubber 35000, steel 60000. The damage floor was
raised from 8 J to 25 J, which is five times the largest settling contact observed and far
below even a glancing hit, so the two are separated cleanly.

**What this buys.** A square hit destroys a crate outright, brick takes two, and a steel
column survives being shot and has to be beaten down. The jostling of a collapse chips
pieces without dissolving the structure, which is what the reference clip shows: blocks
mostly tumble, and some of them break.

**Rollback.** Both numbers are named constants with their reasoning attached, in
`src/blocks/families.js` and `src/core/constants.js`. Changing them changes no code.
