# Contributing

## Setting up

    git clone https://github.com/NCD01/Impact-_Theory.git
    cd Impact-_Theory
    npm install
    npm run dev

Node 20.19 or newer. For the browser tests, once: `npx playwright install chromium`.

## Before you change anything

Read `docs/ARCHITECTURE.md`. Every module has an owner and a list of what it must not own,
repeated in its own file header. Most review comments on this project would be "that
belongs in another file", so the boundaries are written down rather than assumed.

Read `docs/DECISIONS.md` for anything that looks odd. Several things here that look like
mistakes are deliberate and recorded, including the material densities, the synthesised
audio, and why `vite preview` cannot serve the build.

## Branching

`main` is the published branch, and a push to it deploys. Work on a branch named for what
it does, `fix/arch-sinks-through-footing` rather than `patch-1`, and open a pull request.
CI runs lint, the unit suite, the block conversion, a build and the browser suite.

## Before every commit

In this order, with no steps merged and none skipped:

1. `npm run verify` clean, and `npm run e2e` too if you touched rendering, models,
   animation or gameplay pathing.
2. Bump the version in `package.json` **and** `src/core/version.js`. They must agree.
3. Write the CHANGELOG entry. It ships in the same commit as the change it describes, not
   the next one.
4. Stage.
5. Commit with the message contract below.
6. Push.

If a change cannot go green within reasonable effort, revert it, commit the last green
state, and record the attempt. Never leave the tree broken.

## Versioning

`MAJOR.MINOR.PATCH+BUILD`, defined in `docs/VERSIONING.md`, which is the only file that
states the rules. Everything else points at it. BUILD increments on every version change
without exception.

## Commit messages

    <type>: <what changed, in plain language> - v<version>

    <why it changed, one or two sentences>
    <what was validated, and how>

Types: Feature, Fix, Refactor, Documentation, Logging, Structural, Asset, Test.

`Fix: S05_ARCH no longer sinks through the footing at high impact - v1.2.1+14` is a commit
message. `updates` is not.

**The validation line is not a formality.** It says what you actually ran or looked at.
"Tests pass" is weak. "npx vitest run reports 139 of 139, and level 12 was played through
in a browser at a phone viewport" is a claim someone else can check.

## Code style

- File order: header comment, imports, constants, types, public functions, private
  helpers.
- Every file opens with a header saying what it owns and what it must not own.
- Every public function says what it does, what it assumes, what it returns, and what
  breaks if it is called out of order.
- **Every tuning constant carries its value, its reason and where the number came from.**
  A number with no reason attached is the thing a future maintainer cannot safely change.
- No repeated inline literals. Named constant blocks, with units in the comment.
- All screen to world arithmetic goes through `src/core/projection.js`. No exceptions.
- Do not narrate the obvious. Comment the decision, not the syntax.

## Writing style for documents

No em dashes, use commas or parentheses. No emoji in shipped prose. Avoid the words
*delve*, *leverage*, *robust*, *seamless*, *unlock*, *dive into* and *game-changer*, and
the phrases *it is worth noting* and *at the end of the day*.

## Adding or changing a level

Edit the design in `scripts/author-levels.mjs`, then:

    node scripts/author-levels.mjs
    npm test

The validator runs over every level in the unit suite, so a bad piece id or an over budget
level fails there rather than shipping. The format is in `docs/LEVEL_FORMAT.md`.

Keep structures tall rather than wide. A level much wider than about 12 SU gets pushed a
long way back to fit a portrait phone screen, because the horizontal field of view is less
than half the vertical one.

## Updating the art

Replace the FBX files under `Assets/Art/Blocks/`, then:

    npm run convert:blocks
    node scripts/write-block-kit-doc.mjs
    npm test

The conversion checks every piece against `block_asset_manifest.json` and exits non zero
on any mismatch, so a conversion that shifts a pivot fails loudly rather than quietly
turning every level into a leaning tower.

**Never modify a file under `Assets/` as part of a build step.** They are inputs.

## What not to build

The scope is fenced deliberately: no multiplayer, leaderboards, accounts, backend, ads,
purchases, analytics, level editor, cosmetics shop, achievements, cloud saves or native
packaging. No new 3D modelling beyond the existing kit plus primitives. No more than
thirty hand designed levels.

## One thing to be careful about

`H:\Marcelo\Programming\Games\` also contains `IT`, a separate live project whose git
remote is `https://github.com/NCD01/Impact-Theory.git`, **without** the underscore. This
project's remote has one. A duplicate working copy pointing at the wrong project's remote
has already cost this owner once. Run `git remote -v` and read the result before pushing.
