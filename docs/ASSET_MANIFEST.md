# Asset manifest

Every asset this game ships, where it came from, who made it and under what licence.

**The short version: no third party art, audio or font ships in this game.** The build
output contains no image file, no audio file and no font file at all. Everything visible
is either the owner's own modelling or generated in code at runtime.

## What is in the build output

    dist/index.html                        9.6 kB   markup, stylesheet, boot screen
    dist/assets/index-*.js               881.4 kB   game code, three.js, Rapier bindings
    dist/assets/rapier_wasm3d_bg-*.wasm    2.0 MB   Rapier physics engine, WebAssembly
    public/models/blocks/*.glb           15 files   the block kit, converted from FBX

That is the whole list. Nothing else is served.

## The block kit: the owner's own work

| Asset | Source | Author | Licence | Where used |
|---|---|---|---|---|
| `Assets/Art/Blocks/*.fbx`, 15 V1 models | This project's earlier art pass | Marcelo De Freitas | Owner's own work | Geometry source, via the V2 variants |
| `Assets/Art/Blocks/MaterialVariants/V2/*.fbx`, 15 V2 variants | The same art pass | Marcelo De Freitas | Owner's own work | **Converted to `.glb` and shipped.** Every structure in the game |
| `Assets/Art/Blocks/Previews/**/*.png`, 73 renders | The same art pass | Marcelo De Freitas | Owner's own work | Not shipped. Read during development to recover the material colours |
| `Assets/Art/Blocks/Source/*.blend` | The same art pass | Marcelo De Freitas | Owner's own work | Not shipped. Reproducible source |
| `Assets/Art/Materials/V2/V2_MATERIAL_LIBRARY.blend` | The same art pass | Marcelo De Freitas | Owner's own work | Not shipped. The authored material definitions |
| `Assets/Art/Blocks/block_asset_manifest.json` and `.csv` | The same art pass | Marcelo De Freitas | Owner's own work | **The authority on every dimension and pivot in the game** |

The FBX originals are never modified. `scripts/convert-blocks.mjs` reads them and writes
`.glb` files into `public/models/`, which is generated and not committed.

## Generated in code, original to this build

| Asset | Made by | Licence | Where used |
|---|---|---|---|
| 12 material textures: wood grain, wood end grain, brick, concrete, stone, cut stone, brushed steel, four painted steels, rubber | `src/render/materials.js`, drawn to a canvas at load | MIT with this project | Every block surface |
| The cannon: barrel, muzzle ring, base, muzzle flash | `src/game/cannon.js`, three.js primitives | MIT with this project | Every level |
| The ball, with baked stripe vertex colours | `src/game/balls.js` | MIT with this project | Ammunition |
| Ground plane, sky dome, fog, lighting | `src/render/scene.js` | MIT with this project | Every level |
| Dust particles | `src/render/dust.js` | MIT with this project | Every fracture |
| Every sound: impacts per family, cannon, fracture, rumble, level clear, fail, interface tap | `src/audio/audio.js`, Web Audio synthesis | MIT with this project | Throughout |
| Star glyphs and interface icons | Unicode characters in `src/ui/ui.js` | Not applicable | Interface |
| All 30 level layouts and their names | `scripts/author-levels.mjs` | MIT with this project | The game |

**There is deliberately no background music.** A slow pad shipped in v1.9.0 and was removed
in v1.13.0. A sustained drone under a game built on percussive impacts fights the thing the
player is listening for, and on a level replayed twenty times it becomes noise. If music is
ever wanted it belongs as a short loop that ducks under impacts, not a continuous pad.

**Why the material textures are generated rather than exported.** The V2 FBX files carry
material names and per face assignment but no appearance: every material reads back as
`#cccccc` with no texture. The V2 look was authored as procedural Blender node materials,
which FBX cannot carry. Baking them would need Blender, which is not installed on the
build machine. The colours were read off the owner's own V2 preview renders, so the result
approximates the approved art direction rather than inventing one.

**Why the audio is synthesised.** See `docs/DECISIONS.md` D-008. In an unattended session
there is nobody to confirm a sound pack is genuinely CC0, and the standard says no asset
ships without a licence you read. Arithmetic has no licence question.

## Fonts

None are shipped. The interface uses a system font stack: Trebuchet MS, Segoe UI, then the
platform's own `system-ui`. Nothing is downloaded.

## Third party code

| Package | Version | Licence | Shipped |
|---|---|---|---|
| `three` | 0.185.1 | MIT | Yes, tree shaken into the bundle |
| `@dimforge/rapier3d` | 0.20.0 | Apache 2.0 | Yes, as JavaScript bindings plus a `.wasm` file |
| `vite` | 8.2.2 | MIT | No, build tool |
| `vite-plugin-wasm` | 3.6.0 | MIT | No, build tool |
| `vitest` | 4.1.11 | MIT | No, test tool |
| `@playwright/test` | 1.62.1 | Apache 2.0 | No, test tool |
| `eslint`, `@eslint/js`, `globals` | 10.9.1 and companions | MIT | No, lint tool |

Versions are as installed. `package.json` and `package-lock.json` are the authority.

## Reference material, which is not an asset

`Reference/` holds a 4.6 second recording of another studio's commercial game, its
original phone capture, and nine stills. It is design reference. **It is not licensed for
reuse and nothing from it ships.** No name, art, sound, icon, interface text or level
layout from it appears anywhere in this project. Piece names come from the manifest; level
names, colours and every word of copy are original to this build.

## Assets considered and not used

- **CC0 sound packs.** Not used, for the licence verification reason above. Worth
  revisiting when someone is awake to check a licence: recorded impacts would sound better
  than synthesised ones, and the audio module exposes one function per sound, so swapping
  in samples touches one file.
- **CC0 environment art**, palm trees, a hut, beach props, to match the reference clip's
  backdrop. Not sourced, for the same reason and because that phase was cut for time. The
  playfield is currently a sand plane under a sky dome with no backdrop objects. **This is
  the largest visible gap against the reference clip.**
- **`Assets/Resources/Backgrounds/NCD_RetroArcade_Background_v1.png` and `v2.png`.** Found
  in the asset tree, belonging to a different project of the owner's. Moved into
  `_source/unity-checkpoint/` rather than deleted. Not used, and worth keeping because
  they are the other project's art and deleting someone's art is not this build's call.
