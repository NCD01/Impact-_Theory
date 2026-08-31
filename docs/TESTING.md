# Testing

Two suites. The unit suite runs in Node and is fast enough to run on every save. The
browser suite drives a real browser against the real production build and is the only one
that can see the things that actually broke in this project.

## Running them

    npm run lint       # ESLint over src, scripts and tests
    npm test           # Vitest, 139 unit tests, about 6 seconds
    npm run verify     # lint and unit tests together
    npm run e2e        # Playwright, 10 tests across two viewports, about 2 minutes

The browser suite needs a browser once:

    npx playwright install chromium

It does not need a server running. The Playwright config builds the project and serves
`dist/` itself.

`npm test` runs `npm run convert:blocks` first, through npm's `pretest` hook, so the
conformance tests never check stale geometry.

## The unit suite

`tests/unit/`, run by Vitest in a Node environment. No DOM, no WebGL, no WebAssembly,
which is why 139 tests finish in six seconds.

| File | Tests | Covers |
|---|---|---|
| `block-manifest.test.js` | 34 | All fifteen pieces against an independently restated manifest table; both geometric-center pivots; collider shapes and volumes; that every converted `.glb` exists on disk with the right measured dimensions and pivots; that draw calls per piece stayed low. |
| `levels.test.js` | 52 | Every shipped level through the validator; that ids run 1 to 30 with no gaps; that names are unique; that par rises across the set; the piece budget; and each validator rule tested separately against a level that breaks exactly that rule. |
| `save.test.js` | 17 | Migration from a genuine schema version 1 save; that a corrupt, hostile or non JSON save cannot crash the game; that a worse replay never lowers a recorded result; that a storage which throws on write still allows play. |
| `scoring.test.js` | 23 | Piece values by family; the combo window, step and cap; star bands on both difficulties; the ball allowance; and the damage model including the energy floor, accumulation, and the graze versus square hit distinction. |
| `endless.test.js` | 13 | That the generator emits the standard schema; that 200 consecutive rounds are all legal and inside the body budget; that a round is reproducible from its number; and that level size measurement handles piece extents and geometric-center pivots. |

**The validator tests are the point of `levels.test.js`.** A validator that passes
everything would let all thirty levels pass while a piece id typo shipped, so each rule is
proved by a level that violates it.

**The migration test is the point of `save.test.js`.** It loads a save of the exact shape
schema version 1 wrote and asserts the cleared levels and the unlock survive. A child who
has cleared twenty levels must not lose them because the schema gained a field.

## The browser suite

`tests/e2e/`, run by Playwright against the built site served by
`scripts/serve-dist.mjs`. Two projects: a phone at 390 by 844 with touch, and a desktop at
1280 by 720 with a mouse. Five tests each.

| Test | Acceptance criterion |
|---|---|
| Boots with every asset loaded | 15 of 15 models loaded and 0 failed, read from the loader's own count rather than from the manifest; 30 levels bundled; no console errors of any kind. |
| Plays a level through to results | Title, level select, level 1 loads with pieces placed, shots fired until the results screen appears, the result says cleared with at least one star, and level 2 is unlocked. |
| A shot fires, hits and damages | Balls actually left the cannon, and a non zero impact energy was recorded, which means they arrived. |
| Survives a viewport change | After rotating from portrait to landscape mid level, firing still works, which proves the projection helper was refreshed. |
| Visual gate, four classes | Below. |

**Why it runs against the production build and not the dev server.** The deployable
artefact is the thing worth testing. `vite preview` cannot serve it at all: it rejects any
request carrying `Sec-Fetch-Dest: script`, which is what a browser sends for a module
script, so the game 404s its own bundle under preview while curl fetches it happily. See
[DECISIONS.md](DECISIONS.md) D-011.

**Why the GPU flags.** Headless Chromium defaults to SwiftShader and software renders
everything. Screenshots still come out, but any frame rate read from that context is
meaningless. The config passes `--use-angle=default --enable-gpu
--ignore-gpu-blocklist`, which on this machine gives real hardware; the renderer string is
recorded in the body budget spike output.

## The visual gate

The standards require four screenshot classes per change to rendering, models, animation
or gameplay pathing, each judged against a stated criterion. All four are captured at both
viewports, so eight images per run, into `.agent_temp/screenshots/`.

| Class | Acceptance criterion, checked in code |
|---|---|
| Playing, debug overlay off | The structure is present and standing, so pieces exist and none has already fallen at load. |
| Playing, debug overlay on | The overlay is visible and carries real frame rate and body counts, not a placeholder. |
| Level select | All thirty cells present, and horizontal page overflow is at most 1 px. |
| Results screen | The star row is visible and the score is not empty. |

The criteria are assertions rather than notes, so the gate fails rather than producing
eight images nobody looks at.

## What the browser suite caught that the unit suite could not

All three were real defects in this build, and none is visible from Node.

1. **Hidden screens swallowed every touch.** `.screen { display: grid }` is a class
   selector and beats the browser's own `[hidden] { display: none }`, so an invisible
   settings panel stayed laid out and intercepted presses meant for the screen behind it.
2. **A cleared level never showed its results.** The settle check counted every body's
   motion including balls, so one ball rolling slowly kept the world unsettled forever.
3. **Levels were framed for the wrong size.** Small levels were a speck under empty sky;
   large ones overflowed the screen in both directions.

## The body budget spike

Not part of either suite, because it is a measurement rather than a test. With a dev
server running:

    npm run dev
    node scripts/spike-body-budget.mjs

Environment variables `COUNTS`, `SAMPLES` and `CPU_THROTTLE` control it. It writes
`docs/body-budget-spike.json`. The result and its caveats are decision D-006.

## Not covered

Stated plainly rather than left to be discovered.

- **No test runs on a real phone.** Everything is Chromium mobile emulation on a laptop.
- **No deterministic physics replay test.** The brief asked for a fixed seed, fixed
  timestep rig asserting a known structure collapses. The timestep is fixed and the
  endless generator is seeded, but Rapier's own solver is not seeded from here, so a rig
  that asserted exact positions would be brittle. The browser suite asserts the outcome, a
  level being cleared, rather than the trajectory.
- **No audio assertion.** The suite checks that the audio system reports itself available.
  Nothing verifies what it sounds like.
- **No test of the GitHub Actions workflows.** They are committed but have not been
  observed running.
