# The level format

One schema serves the thirty hand designed levels and endless mode alike, so there is
exactly one format to validate, one to document and one to load. If endless mode ever
needs its own format, the format is wrong.

`src/game/level.js` is the authority on what is legal. This document describes it.

## Where levels live

`levels/01.json` through `levels/30.json`. They are bundled into the build rather than
fetched, so a malformed level is a build error rather than a blank screen mid game.

They are emitted by `scripts/author-levels.mjs`, which holds the thirty designs. Edit a
design there and rerun `node scripts/author-levels.mjs`. The JSON files are committed and
are what the game reads.

## A worked example

This is `levels/01.json`, complete and unedited:

```json
{
  "schema": 1,
  "id": 1,
  "name": "First Light",
  "par": 3,
  "note": "One crate on two short columns. Teaches that knocking a support drops the load.",
  "pieces": [
    { "piece": "S02_SHORT_COLUMN", "x": -1.2, "y": 0, "support": true },
    { "piece": "S02_SHORT_COLUMN", "x": 1.2, "y": 0, "support": true },
    { "piece": "B02_MEDIUM_BLOCK", "x": 0, "y": 2 }
  ]
}
```

Two short columns, each 2 SU tall, marked as supports. A 2 SU wide crate resting across
them at 2 SU, which is exactly the columns' height. Par is three balls.

## Top level fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schema` | integer | yes | Must be `1`. A file with a higher number is rejected rather than guessed at. |
| `id` | integer | yes | Positive, unique across the set, and the order levels are played in. |
| `name` | string | yes | Shown on the level select and in the heads up display. Must not be empty. |
| `par` | integer | yes | Positive. The balls a good player needs. Drives stars and, on Normal, the ball allowance. |
| `note` | string | no | A designer's note. Ignored by the game. |
| `pieces` | array | yes | At least one, at most `LEVEL.MAX_PIECES`, currently 45. |

There is no schema migration for levels. Unlike a save file there is never an old level in
the wild: levels ship inside the build, so if `schema` ever changes, every level changes
with it in the same commit.

## Piece fields

| Field | Type | Required | Default | Meaning |
|---|---|---|---|---|
| `piece` | string | yes | | A piece id from `Assets/Art/Blocks/block_asset_manifest.json`. |
| `x` | number | yes | | Horizontal position in SU, relative to the structure origin. Positive is to the player's right. |
| `y` | number | yes | | Height in SU. Must not be below zero. |
| `z` | number | no | `0` | Depth in SU. Negative is away from the camera. Rarely needed. |
| `rotY` | number | no | `0` | Rotation about the vertical axis, in radians. |
| `family` | string | no | the piece's own | A material family override. Changes physics, not appearance. |
| `support` | boolean | no | `false` | Marks the piece as something the structure stands on. |
| `fixed` | boolean | no | `false` | Makes the piece immovable scenery. Rarely wanted. |

## What `y` means, and the one thing that catches everyone

`y` is where the piece's **authored origin** goes, and thirteen of the fifteen pieces have
a **center-bottom** pivot: the origin sits on the base. So `"y": 2` puts the underside at
2 SU, and a 1 SU tall piece there occupies 2 to 3 SU.

Two pieces are different. `A03_CROSS_BEAM` and `A04_ROLLER` have **geometric-center**
pivots, so the origin is in the middle. `A03_CROSS_BEAM` is 3 SU tall, so `"y": 3` puts
its underside at 1.5 SU, not 3.

The full table is in [BLOCK_KIT.md](BLOCK_KIT.md). Stacking a geometric-center piece as if
it were center-bottom leaves it half buried in whatever is beneath it, and it looks like a
physics bug rather than a placement one.

## Supports

Marking a piece `"support": true` excludes it from the level clear check. That is what
lets a level be cleared by knocking the load off a pair of pedestals while the pedestals
themselves survive, exactly as in the reference clip.

**Only three pieces may be supports:** `S01_ROUND_COLUMN`, `S02_SHORT_COLUMN` and
`S03_WIDE_FOOTING`. Marking anything else is rejected by the validator.

Supports are still dynamic bodies. Knocking one out drops what stands on it, and that
comes from the physics rather than from a scripted trigger.

A level made entirely of supports is rejected, because it would be cleared the instant it
loaded.

## Material overrides

`"family": "stone"` on a wooden crate makes it behave like stone: heavier, tougher, worth
more. **It does not change how the piece looks.** Appearance is the owner's approved V2
art direction and is not a level's business. A level that wants a stone looking piece
should place a piece whose art is stone.

The seven families are `wood`, `brick`, `stone`, `concrete`, `steel`, `paintedSteel` and
`rubber`. Their values are in [BLOCK_KIT.md](BLOCK_KIT.md).

## The piece budget

A level may place at most 45 pieces. The cap comes from the phase 3 body budget spike:
about 120 concurrent dynamic bodies hold 45 frames per second, and a collapsing level's
fragments and the balls in flight have to fit inside that too. See
[DECISIONS.md](DECISIONS.md) decision D-006.

The validator enforces it, so an over budget level fails the test suite rather than
shipping and stuttering on the target phone.

## Size and framing

The camera is fixed during play. Where a structure is *placed* is computed from its own
height and width, so a small level sits nearer the cannon and a large one further back.
Nothing in the level file controls this, and nothing needs to.

Width matters more than height on a phone. The vertical field of view is 58 degrees, but a
390 by 844 screen has an aspect near 0.46, so the horizontal field of view is less than
half the vertical one. **A level much wider than about 12 SU will be pushed a long way
back to fit.** Keep structures tall rather than sprawling.

## Validation

`validateLevel(data, source)` returns an array of problems and reports **every** problem it
finds rather than the first, because someone fixing thirty levels wants the whole list. An
empty array means the level is legal.

The unit suite runs it over every shipped level, and separately tests each rule by feeding
it a level that breaks exactly that rule. Run it with `npm test`.

Problems it catches, each with the offending value named:

- a `piece` that is not in the block manifest
- a `family` that is not a real material family
- a `support` on a piece that may not be one
- a level with no non support pieces
- a wrong `schema`, a missing `name`, a non integer or non positive `par`
- a piece below the ground plane
- a non finite coordinate
- more pieces than the budget allows
- anything that is not an object at all
