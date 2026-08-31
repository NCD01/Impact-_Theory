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
