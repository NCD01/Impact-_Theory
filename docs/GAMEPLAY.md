# Gameplay

Every number here is read from `src/core/constants.js`, `src/blocks/families.js` and
`src/game/scoring.js`. If one disagrees with the code, the code is right and this file is
stale; say so rather than working around it.

## The loop

A cannon sits at the near edge of a sand playfield. A structure stands up-screen, built
from the fifteen piece block kit, usually on supports. Fire balls at it. When every non
support piece is destroyed or has come down, the level is cleared.

The camera is fixed for the whole of a level, matching the reference clip. Where a
structure is *placed* is chosen per level from its height and width, so a small level sits
nearer the cannon and a large one further back.

## Controls

| Action | Gesture |
|---|---|
| Aim | Touch where you want to hit. The cannon aims there. |
| Fire one | Lift your finger, or click. |
| Fire a stream | Press and hold for 0.28 s, then shots leave every 0.17 s. |

**Aiming is absolute, not relative.** The pointer position is resolved through the single
projection helper onto a vertical plane at the structure's own depth, which gives the world
point the player is pointing at. The cannon is then aimed to *land a ball* on that point,
not merely to point at it: at 27 SU/s a shot across the playfield drops well over a metre,
so the launch angle comes from the standard projectile solve

    tan(theta) = (v² - sqrt(v⁴ - g(g d² + 2 h v²))) / (g d)

taking the flatter of the two roots. Out of range, the barrel goes to 45 degrees, which
reaches furthest.

Yaw is clamped to plus or minus 0.62 rad, pitch to between -0.02 and 0.58 rad. The barrel
can neither point at the sky, which wastes a shot, nor back at the player.

A relative drag scheme shipped first and was replaced. It required the player to work out
where the barrel would end up rather than simply pointing at a target, and its yaw sign was
inverted so that dragging right aimed left.

## Destruction

**Damage is impact energy, not hit count.** On every contact the physics layer computes

    v_rel = (v1 - v2) projected on the contact normal, from pre-step velocities
    mu    = m1 * m2 / (m1 + m2), or just m against the ground
    E     = 0.5 * mu * v_rel²

and a piece accumulates that energy until it reaches its hit points. A graze and a square
hit are therefore different events, which is the whole point: a hit counter would reward
spraying shots rather than aiming them.

Impacts below 25 J do nothing at all. That floor is measured, not chosen: a standing
structure produces thousands of contacts, all of them under 10 J, and without a floor it
would grind itself apart while nobody was shooting.

**When a piece runs out of hit points it fractures.** It is removed and replaced by three
to five smaller rigid bodies that inherit its velocity, plus a dust burst. The fragments
are real bodies with mass that land, settle and can be hit again. Fragments despawn once
they have come to rest, never mid air, and are capped at 36 so a full collapse cannot
spend the body budget on rubble.

What makes a hit read as heavy, all scaled by the same energy number:

- a camera shake, with a floor at 12 J so grazes stay still
- an impact sound voiced by the material family and scaled in loudness and pitch
- dust and real debris
- momentum carried through the stack, which is the physics engine's answer and not a
  scripted one

Nothing plays a canned collapse. Pieces above a broken piece fall because nothing is
holding them up.

## Material families

| Family | Density (kg/SU³) | Restitution | Friction | Hit points (J) | Score weight |
|---|---|---|---|---|---|
| Wood | 340 | 0.16 | 0.62 | 8,000 | 1.0 |
| Brick | 720 | 0.10 | 0.78 | 18,000 | 1.4 |
| Stone | 900 | 0.08 | 0.84 | 30,000 | 1.8 |
| Concrete | 820 | 0.09 | 0.80 | 24,000 | 1.6 |
| Steel | 1150 | 0.22 | 0.50 | 60,000 | 2.4 |
| Painted Steel | 1050 | 0.20 | 0.54 | 40,000 | 2.1 |
| Rubber | 420 | 0.72 | 0.90 | 35,000 | 1.2 |

Roughly: a square ball hit is worth 5,000 to 50,000 J, a glancing hit a few hundred. So
wood goes in one good hit, brick takes two, and a steel column has to be beaten down.

Rubber is the one family that genuinely bounces, which is why a ball off a roller goes
somewhere else, and why placing a roller in a structure is a decision.

## Level clear

Stated once, in one function, in `src/game/structure.js`:

> A level is cleared when every non support piece is either destroyed, or has come to rest
> with its centre below 0.62 SU, or has been knocked more than 34 SU from the structure
> origin.

Supports are excluded, which is what lets a level be cleared by knocking the load off a
pair of pedestals while the pedestals survive.

The clear is only declared once the condition holds **and** the world has been quiet for
1.1 s. Without that, a structure mid collapse satisfies the condition for a single frame
and the results screen appears over a still moving pile. Balls are excluded from that
quietness check: a ball rolling across the sand long after the tower fell is not a reason
to withhold a result.

## Scoring

**Per piece:** 100 base points times the family's score weight times the current combo
multiplier.

**Combo:** pieces destroyed within 1.4 s of each other belong to one chain. The multiplier
starts at 1 and rises by 0.5 per further piece, capped at 6. The window is set to roughly
how long a collapse takes to propagate down a stack, so one good shot that brings a tower
down reads as one large combo rather than five unrelated hits.

**End of level:** 250 points per unused ball, on a difficulty that limits them.

## Structures

Every level stands on a **platform**: a pair or more of pedestals carrying a continuous
deck. Pedestals sit under every joint in that deck, so the deck is properly carried and
everything above it has continuous ground. A beam spanning two pedestals is still a span,
which is correct and is what the reference clip shows; what never happens is a piece with
nothing beneath it. `scripts/verify-level-support.mjs` checks this and the unit suite runs
the same check, so it cannot regress.

## Stars

Three stars for clearing at or under par plus the difficulty's slack, two within the wider
band, one for clearing at all. **A cleared level is never worth zero stars.** A child who
finished a level and was shown nothing has been told they failed.

| | Three stars | Two stars |
|---|---|---|
| Normal | at or under par | within par + 2 |
| Easy | within par + 2 | within par + 5 |

## Difficulty

Two modes, chosen in settings, changeable at any time, stored in the save. **Difficulty
changes tuning values only.** There is one code path through the game; every difference is
a number read from a table.

| | Easy | Normal |
|---|---|---|
| Target age | roughly 4 to 7 | roughly 8 to 12 |
| Balls | unlimited | par |
| Can fail | never | yes |
| Ball radius | 0.42 SU | 0.30 SU |
| Hit points scaled by | 0.55 | 1.0 |
| Damage scaled by | 1.35 | 1.0 |
| Star bands | wider | standard |

On Easy the heads up display shows a dash rather than a number for balls, so it reads as
having no limit rather than a limit a long way off.

## Progress

Level 1 is open; clearing a level opens the next. Stars, best score and fewest balls are
kept per level, and a worse replay never lowers a recorded result.

Progress lives in `localStorage` under a versioned schema with a migration chain, so a
save written by an older version still loads. A browser with storage disabled falls back
to an in memory save that works for one session rather than refusing to start.

## Endless mode

Seeded procedural structures emitting the exact same level schema, validated by the same
validator. Round *n* always produces the same structure, so a run is reproducible and a
bug in a generated level can be reported by its number. Structures grow for the first
dozen rounds, then get denser rather than larger, so a long run does not walk past the
body budget.
