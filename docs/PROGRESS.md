# Progress

One line per phase, appended as the work happens. A phase is **done**, **partial** or
**skipped**. There is no fourth state, and nothing here is written in advance of the
work it describes.

A crashed session resumes by reading this file rather than guessing.

| Phase | State | Notes |
|---|---|---|
| 0. Ground truth and toolchain | in progress | Workspace measured. Three findings corrected against the brief, see D-001 and the notes below. Toolchain proof under way. |
| 1. Repo, asset backup, docs, first push | in progress | Asset backup committed and pushed, verified against the remote. Documentation set under way. |
| 2. Block kit pipeline | not started | |
| 3. Body budget spike | not started | |
| 4. Vertical slice | not started | |
| 5. Destruction feel | not started | |
| 6. Level format and 30 levels | not started | |
| 7. Scoring, stars, combos | not started | |
| 8. Difficulty modes | not started | |
| 9. Endless mode | not started | |
| 10. Remaining art and environment | not started | |
| 11. Audio | not started | |
| 12. User interface and menus | not started | |
| 13. Tests | not started | |
| 14. Documentation and deploy | not started | |
| 15. Final verification and report | not started | |

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
