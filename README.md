# Impact Theory

A physics demolition game for a phone browser. A cannon at the near edge of a sand
playfield fires balls at a structure built from a fifteen piece block kit standing on
supports. The structure is a real rigid body assembly, so it leans, buckles and falls the
way its geometry says it should, and clearing it clears the level.

Current version **1.13.0+19**. The version scheme is defined in
[docs/VERSIONING.md](docs/VERSIONING.md), which is the only file that states it.

## Requirements

- Node.js 20.19 or newer. Built and tested on v24.18.0.
- npm 10 or newer. Built and tested on 11.16.0.
- A browser with WebGL 2 and WebAssembly. Any current phone or desktop browser.

Nothing else. There is no game engine, no framework and no build step beyond Vite.

## Install and run

Every command below was run on this machine before it was written here.

    npm install
    npm run dev

Then open the address the dev server prints, by default `http://localhost:5173/`.

To build and check the production bundle:

    npm run build
    npm run serve:dist

That serves the built site at `http://localhost:4180/Impact-_Theory/`.

**Use `npm run serve:dist` rather than `npm run preview`.** Vite's preview server rejects
any request carrying `Sec-Fetch-Dest: script`, which is exactly what a browser sends for a
module script, so the built game returns 404 for its own bundle under preview while curl
fetches it happily. GitHub Pages is a plain static host with no such middleware. The full
diagnosis is in [docs/DECISIONS.md](docs/DECISIONS.md), decision D-011.

## Controls

One gesture does everything, on touch and with a mouse alike.

| Action | Touch and mouse |
|---|---|
| Aim | **Touch where you want to hit.** The cannon aims at that spot. Slide your finger and the aim follows it. On a desktop the cannon follows the mouse with no button held. |
| Fire one ball | Lift your finger, or click. |
| Fire a stream | Press and hold. Shots leave at a capped rate. |
| Pause | The button in the top right. |

The aim is **absolute, not relative**: the barrel goes where your finger is, with no
memory of where it was. It also compensates for the drop over the flight, so pointing at a
block aims to land on that block rather than merely pointing the barrel at it.

## Difficulty

Chosen in Settings, changeable at any time, and stored in the save. Difficulty changes
tuning values only; there is one code path through the game.

- **Easy**, for roughly four to seven years old. Unlimited balls, no fail state ever, a
  larger ball, and weaker pieces so something visible happens on every shot.
- **Normal**, for roughly eight to twelve. Balls limited to the level's par, and a level
  can be failed and retried.

## Project structure

| Folder | What it holds |
|---|---|
| `src/` | All game source. One folder per concern, described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). |
| `levels/` | The thirty hand designed levels, as JSON data. |
| `scripts/` | Build and authoring tools: block conversion, level authoring, the body budget spike, the static server, the block kit doc generator. |
| `tests/` | `unit/` runs in Node under Vitest. `e2e/` drives a real browser under Playwright. |
| `Assets/` | The authored art. FBX models, Blender sources, previews and manifests. Inputs, never modified by the build. |
| `Reference/` | The reference clip and stills the game is modelled on. Not licensed for reuse. |
| `docs/` | Everything below the front door. |
| `_source/` | The archived Unity project this build replaced. Nothing here is built or run. See [docs/ARCHIVE.md](docs/ARCHIVE.md). |
| `public/` | Generated at build time. Not committed. |

## Tests

    npm run lint       # ESLint over src, scripts and tests
    npm test           # Vitest, 178 unit tests
    npm run verify     # lint and unit tests together
    npm run e2e        # Playwright, 12 browser tests across two viewports

The browser suite builds the project and serves it itself, so it needs nothing running
first. It does need a browser: `npx playwright install chromium` once.

What each suite covers is in [docs/TESTING.md](docs/TESTING.md).

## Documentation

| File | What it answers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | What each module owns and what it must not own. |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md) | Mechanics, scoring, stars, difficulty tables. |
| [docs/BLOCK_KIT.md](docs/BLOCK_KIT.md) | The fifteen pieces, their dimensions, pivots, families and colliders. Generated from the manifest. |
| [docs/LEVEL_FORMAT.md](docs/LEVEL_FORMAT.md) | The level JSON schema, field by field, with a worked example. |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every decision taken alone, with its alternatives and rollback cost. |
| [docs/VERSIONING.md](docs/VERSIONING.md) | The version scheme. The only file that states it. |
| [docs/TESTING.md](docs/TESTING.md) | How to run each suite and what it covers. |
| [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) | Every shipped asset with its source, author and licence. |
| [docs/ARCHIVE.md](docs/ARCHIVE.md) | What is in `_source/`, and how to get it back. |
| [docs/PROGRESS.md](docs/PROGRESS.md) | One line per build phase. |
| [CHANGELOG.md](CHANGELOG.md) | Newest first, with validation evidence per entry. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to set up, branch, commit and test. |

## Asset credits

**The owner's own work.** Everything under `Assets/Art/Blocks/` and
`Assets/Art/Materials/`: the fifteen structural block models in FBX, their V2
materialized variants, the transparent preview renders, the Blender sources and the
material library. This is a finished art pass that predates this build, and this build
consumes it without modifying it.

**Original to this build.** All game code. The cannon, the ball, the ground and the sky,
which are built from primitives in code. The twelve procedural material textures in
`src/render/materials.js`, which rebuild the appearance of the authored materials because
FBX cannot carry the procedural Blender materials they were authored as. Every sound,
synthesised at runtime with the Web Audio API. All thirty level layouts, their names, and
every word of interface text.

**Third party code.** three.js, MIT licensed, and Rapier, Apache 2.0 licensed, plus the
build and test tooling. Versions and licences are listed in
[docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md); `package.json` is the authority on
versions.

**No third party art or audio ships in this game.** There is no image file, no audio file
and no font file in the build output. The full accounting is in
[docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md).

`Reference/` holds a recording of another studio's commercial game. It is reference
material, it is not licensed for reuse, and nothing from it appears in this project: not
its name, art, sounds, icons, interface text or level layouts.

## Licence

MIT, see [LICENSE](LICENSE). The licence covers the code in this repository. It does not
grant any rights over the contents of `Reference/`.
