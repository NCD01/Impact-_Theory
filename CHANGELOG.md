# Changelog

Newest entry first. The version scheme is defined in `docs/VERSIONING.md`.

Every entry carries a Validation Evidence line stating what was actually run or
looked at. A claim with no evidence line behind it is not a claim this project makes.

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
