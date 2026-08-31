# Changelog

Newest entry first. The version scheme is defined in `docs/VERSIONING.md`.

Every entry carries a Validation Evidence line stating what was actually run or
looked at. A claim with no evidence line behind it is not a claim this project makes.

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
