# Impact Theory: agent router

A pointer file. Nothing is duplicated here that lives somewhere else.

## Where things are

| | |
|---|---|
| Repository | `H:\Marcelo\Programming\Games\Impact Theory` |
| Remote | `https://github.com/NCD01/Impact-_Theory.git` **with the underscore** |
| Branch | `main` |
| Version | Stated in `package.json` and `src/core/version.js`. Scheme in `docs/VERSIONING.md`. |
| Published at | `https://ncd01.github.io/Impact-_Theory/` once Pages is enabled |

## Read these before changing anything

| Question | File |
|---|---|
| What does this module own? | `docs/ARCHITECTURE.md` |
| Why is it built this way? | `docs/DECISIONS.md` |
| What are the pieces and their physics? | `docs/BLOCK_KIT.md` |
| How do I write a level? | `docs/LEVEL_FORMAT.md` |
| How do I run the tests? | `docs/TESTING.md` |
| What is in `_source/`? | `docs/ARCHIVE.md` |

## The two rules most likely to be broken here

**1. There is one remote, and it has an underscore in it.**
`H:\Marcelo\Programming\Games\` also contains `IT`, a separate live project whose remote
is `https://github.com/NCD01/Impact-Theory.git`, without the underscore. The two names
differ by one character. A duplicate working copy pointing at the wrong project's remote
has already cost this owner once. **Run `git remote -v` and read the result before every
push. Never run a git command that writes inside `Games\IT`.**

**2. All screen to world arithmetic goes through `src/core/projection.js`.**
Pointer position to world ray, world position to screen pixels, viewport size and aspect.
The touch handler is the entire control scheme in this game, so a second copy of that
maths in a pointer handler is the most likely way it breaks on a phone while looking
correct on a desktop. If you are about to write `event.clientX / window.innerWidth`
anywhere, the answer is already in that file.

## Things that will surprise you

- **The FBX art carries no material appearance.** Only names and per face assignment.
  Appearance is rebuilt in `src/render/materials.js`. See that file's header.
- **`vite preview` cannot serve this build.** Use `npm run serve:dist`. See D-011.
- **`public/models/` is generated**, not committed. `npm run convert:blocks` makes it, and
  the `predev`, `prebuild` and `pretest` hooks run it for you.
- **The master working copy is on an SMB network share**, so the Vite watcher runs in
  polling mode and `git add` of the asset tree takes about thirty seconds.
