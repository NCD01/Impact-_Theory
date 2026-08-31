# Progress

One line per phase, appended as the work happens. A phase is **done**, **partial** or
**skipped**. There is no fourth state, and nothing here is written in advance of the
work it describes.

A crashed session resumes by reading this file rather than guessing.

| Phase | State | Notes |
|---|---|---|
| 0. Ground truth and toolchain | done | Workspace measured. Three findings corrected against the brief, below. Toolchain proved by running it. |
| 1. Repo, asset backup, docs, first push | done | Asset tree committed and pushed within the first hour and verified against the remote. Unity checkpoint moved with `git mv`. Documentation set complete. |
| 2. Block kit pipeline | done | Scripted FBX to glTF conversion that checks itself against the manifest. 15 of 15 conform. `docs/BLOCK_KIT.md` generated from the manifest, not written by hand. |
| 3. Body budget spike | done | 264 samples across six runs. Ceiling about 120 concurrent bodies for 45 fps, 84 after headroom, 45 pieces per level. D-006. Two earlier failed measurements recorded. |
| 4. Vertical slice | done | Cannon, drag to aim, fire, structure on supports, real collapse, clear detection. |
| 5. Destruction feel | partial | Impact energy model, per family hit points, fracture into real fragments, dust, camera shake and audio all scaled by the same energy. Momentum through the stack and supports dropping their load both come from the physics. **Not done:** no tuning pass with a human watching it, and no debris decals or scorch. See the cheap fakes check below. |
| 6. Level format and 30 levels | done | JSON keyed to manifest piece ids, a validator that reports every problem, 30 hand designed levels, level select with locks, versioned save with a migration chain. |
| 7. Scoring, stars, combos | partial | Model complete and unit tested. **Star thresholds were not tuned by playing all thirty levels**, they are set from par by a rule. |
| 8. Difficulty modes | done | Easy and Normal as tuning tables, one code path, stored in the save. |
| 9. Endless mode | done | Seeded generator emitting the same schema. 200 rounds validated. |
| 10. Remaining art and environment | skipped | The playfield is a sand plane and a sky dome. **No backdrop, no palm trees, no hut.** This is the largest visible gap against the reference clip. Balls and the cannon are built from primitives in code and do exist. |
| 11. Audio | done | Every sound synthesised with Web Audio, scaled by impact energy and voiced per material family. Mute persists. D-008. |
| 12. User interface and menus | done | Title, level select, heads up display, pause, settings, results with stars, score popups. Portrait first, checked in a desktop landscape window. |
| 13. Tests | done | 139 unit tests, 10 browser tests across two viewports, four class visual gate with acceptance criteria asserted in code. Gaps listed in `docs/TESTING.md`. |
| 14. Documentation and deploy | partial | Every document written and every command in the README personally run. Workflows committed. **GitHub Pages needs one switch flipped by hand**, which cannot be done from here. |
| 15. Final verification and report | done | `HANDOFF.md`. |

## Phase 0 notes

Measured on 2026-08-30 by listing and reading the folders directly.

**Corrections to the brief.** Three of its measured claims did not hold up. All three
are recorded because the brief asked for anything measured to beat anything it
asserts.

1. The folder the brief calls `Games\Impact` does not exist. The project is at
   `Games\IT`. See `docs/DECISIONS.md` D-001.

2. **The V2 materialized block library was already under version control, and already
   on GitHub.** The brief states it exists nowhere else and that two commit messages
   claiming to have backed it up are false. That is not what the repository shows.
   `git ls-tree -r origin/main` in `Games\IT` lists all 18 files under
   `Assets/Art/Blocks/MaterialVariants`, including all 15 V2 FBX variants. The commit
   messages were accurate. The reason `git ls-files` returns zero there is different
   and is finding 3.

3. **The `Games\IT` working tree has 162 staged deletions.** Somebody deleted the
   files from disk and staged the deletions, without committing. That is why
   `git ls-files` reports nothing under `MaterialVariants` and why the directory is
   absent from that project's disk. The files are safe in its history and on its
   remote. They would be lost from that working copy if those staged deletions were
   ever committed and pushed. Nothing was done about it from here, because that
   project is read only for this build.

**What this changes.** Not the work, only the urgency and the story. The asset backup
was still the first thing done, because the master folder genuinely had no version
control of its own and a copy on a second remote is worth having. What it changes is
the report: the owner should not be told his commit messages lied, because they did
not, and he should be told about the 162 staged deletions, because that is a live
hazard he may not know about.

**Toolchain, proved by running it.** git 2.54.0.windows.1, node v24.18.0,
npm 11.16.0, ffmpeg 8.1.1, Python 3.12.10. Blender is not installed anywhere on this
machine, which rules out a Blender based asset conversion step. The GitHub CLI is not
installed, which rules out enabling GitHub Pages through an API from here.

**Empty asset folders, confirmed.** `Art/Balls`, `Art/Environment`, `Art/Platforms`,
`Art/UI`, `Audio`, `Reference/Structures` and `Data/StructuralPieces` contain nothing
but a `.gitkeep`, exactly as the brief said. There are no balls, no environment art,
no interface art and no audio in this repository.

## Phase 5: the cheap fakes, checked

The brief names five ways a destruction phase gets faked, and asks which were checked.
Each was checked by reading the code that would have to contain it and by watching the
game run.

| Fake | Shipped? | How it was checked |
|---|---|---|
| Pieces that despawn on contact instead of collapsing | No | A piece is removed only when its accumulated impact energy passes its hit points, and it is replaced in the same call by three to five rigid bodies that inherit its velocity. `src/game/structure.js`, `fracture()`. |
| A canned collapse animation triggered by a hit | No | There is no animation system in this project at all. Nothing calls into an animation mixer, and no keyframe data ships. Pieces above a broken piece fall because nothing holds them up. |
| Default physics parameters with no tuning pass and no impact feedback | Partly avoided | Densities, restitution, friction and hit points are per family with reasons recorded, and hit points were recalibrated against measured impact energies after the first guessed set vaporised every structure (D-007). Feedback exists and is energy scaled: shake, sound, dust, debris. **What is missing is a tuning pass with a human watching**, which nobody could do overnight. |
| Particles standing in for structural failure | No | Dust and fragments are separate systems on purpose, and the module headers say so. Dust has no physics and accompanies a fracture that has already happened; fragments are real bodies with mass that land, settle and can be hit again. |
| A score popup used to make a limp collapse read as a hit | No | Score popups fire on a piece being destroyed, which is the same event that removes the body and spawns the debris. There is no path that shows points without something actually breaking. |

**The honest summary of phase 5:** the mechanism is real and the feedback is wired to real
numbers. Whether it *feels* good is a judgement nobody made, because judging it needs a
person watching a screen. That is the one part of this phase that an unattended session
cannot finish, and it is the first thing to check in the morning.
