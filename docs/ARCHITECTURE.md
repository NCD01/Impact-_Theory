# Architecture

What each folder and module owns, and what it must not own. Every source file repeats its
own entry in its header, so the rule travels with the code.

The shape of the thing: a fixed camera renders a Rapier physics world through three.js,
with a thin DOM overlay for the interface. There is no engine and no framework. One
animation loop in `src/main.js` drives everything.

## Dependency direction

Nothing in `core/` or `blocks/` imports from `game/`, `ui/` or `render/`. The arrows only
point one way, so the data layer can be unit tested in Node with no browser at all, which
is why 139 unit tests run in six seconds.

    core/        constants, projection, version         no dependencies
    blocks/      manifest, families, colliders          depends on core
    physics/     world, damage                          depends on core, blocks
    render/      scene, materials, dust                 depends on core
    game/        structure, session, level, scoring...  depends on all of the above
    ui/          screens and the heads up display       depends on core only
    save/        versioned progress                     depends on core only
    main.js      wiring and the loop                    depends on everything

## The modules

### `src/core/`

| File | Owns | Must not own |
|---|---|---|
| `constants.js` | Every tuning value that is not a material property or level data. The one file to open when something feels wrong. | Material families, level layouts, the version string. |
| `projection.js` | **Every** conversion between screen space and world space, and the cached viewport metrics. | What a gesture means. |
| `version.js` | The version string the running game reports. | The versioning rules, which are in `docs/VERSIONING.md`. |

`projection.js` exists because of one standard: a single projection helper, recalculated
on resize, with no handler doing its own screen arithmetic. On this game the touch handler
is the whole control scheme, so a second copy of that maths is the single most likely way
the game breaks on a phone while looking right on a desktop.

### `src/blocks/`

| File | Owns | Must not own |
|---|---|---|
| `manifest.js` | Reading the authored block manifest and joining each piece to its family and collider. | Any dimension. Every number comes from `block_asset_manifest.json`. |
| `families.js` | The seven physics material families and each piece's default family. | Geometry, or how damage accumulates. |
| `colliders.js` | Collider shapes derived from manifest dimensions, and the pivot lift. | Mass, coefficients, or creating bodies in a world. |
| `loader.js` | Fetching the converted models once and cloning instances. | Physics, placement or dimensions. |

Colliders are derived from the manifest rather than measured from the mesh, on purpose.
Measuring the mesh would make the physics silently follow any future art change, including
a mistaken one, and would make the game behave differently depending on whether a model
had finished loading.

### `src/physics/`

| File | Owns | Must not own |
|---|---|---|
| `world.js` | The Rapier world, body creation and removal, the fixed timestep, and turning contact events into impact energy in joules. | What an impact *means*. It reports energy; it does not decide damage. |
| `damage.js` | The rule that turns energy into damage. Pure arithmetic, no engine imports. | Anything touching Rapier, three.js or the DOM. |

`damage.js` is deliberately pure so the damage model can be unit tested without starting a
physics world, and so the rule can be read in one place rather than inferred from a
collision handler.

### `src/render/`

| File | Owns | Must not own |
|---|---|---|
| `scene.js` | Renderer, fixed camera, lighting, ground, sky, resize, camera shake, per level framing. | Game state. Nothing here knows what a level is. |
| `materials.js` | The appearance of every authored material name, rebuilt as procedural textures. | Physics. A level override changes physics, not appearance. |
| `dust.js` | The dust burst that accompanies a fracture. | Fragments, which are real rigid bodies with mass. |

The dust and fragment split matters. Confusing the two is one of the named cheap fakes:
particles standing in for structural failure. Dust here accompanies a fracture that has
already happened in the physics world.

### `src/game/`

| File | Owns | Must not own |
|---|---|---|
| `structure.js` | The pieces a level places, damage routing, fracture into real fragments, and the single level clear rule. | Scoring, audio, the camera, the level file format. |
| `session.js` | One level attempt: balls remaining, the settle rule, the scoring run. | Rendering, the DOM, input. |
| `level.js` | The level file format, its validator, and loading. | Placing pieces, scoring, progress. |
| `scoring.js` | Piece values, combos, the end of level bonus, stars. | When a piece is destroyed, or what a level's par is. |
| `balls.js` | Balls in flight, their lifetime, and the cap on how many exist. | The fire rate, or how many balls a level grants. |
| `cannon.js` | Aim state, the barrel mesh, the muzzle flash, and where a ball starts. | Input handling, or the fire rate policy. |
| `endless.js` | Generating structures from a seed, in the standard level schema. | A second level format. |
| `stress.js` | Generating an arbitrary sized wall for the body budget spike. | Anything normal play uses. |

### `src/ui/`, `src/save/`, `src/audio/`, `src/input/`

| File | Owns | Must not own |
|---|---|---|
| `ui/ui.js` | Every piece of DOM over the canvas, and the score popups. | Any game rule. It renders what it is given. |
| `save/save.js` | The shape of saved progress, storage, and migration. | What a star is worth, or which level is next. |
| `audio/audio.js` | Every sound, synthesised at runtime. | When a sound should play. |
| `input/controls.js` | Turning pointer events into two intentions, aim and fire. | Any screen to world arithmetic. That is `projection.js`. |

### `src/main.js`

Owns startup, the animation loop, the screen state machine and the wiring. It is the only
file that knows every other module exists. It must not own any rule: if a decision about
the game is being made in `main.js`, it is in the wrong place.

**Frame order is not arbitrary.** Controls, then physics, then the mesh sync, then the
session's clear check, then decoration, then render. Syncing meshes before stepping
physics would draw everything one frame behind the simulation, which reads as input lag
that no amount of tuning fixes.

## Generated, not written

| Path | Made by | Committed |
|---|---|---|
| `public/models/blocks/*.glb` | `scripts/convert-blocks.mjs` | No |
| `public/models/blocks/conversion-report.json` | the same | No |
| `docs/BLOCK_KIT.md` | `scripts/write-block-kit-doc.mjs` | Yes, so it is readable on GitHub |
| `levels/*.json` | `scripts/author-levels.mjs` | Yes, they are the game's data |
| `dist/` | `vite build` | No |

The models are regenerated by the `predev`, `prebuild` and `pretest` hooks, so no command
can run against stale geometry and the deploy workflow rebuilds them from the FBX
originals.
