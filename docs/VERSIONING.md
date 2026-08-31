# Versioning

This file is the single authority on the version scheme for Impact Theory. Any other
document that mentions versioning points here and does not restate the rules.

## Scheme

    MAJOR.MINOR.PATCH+BUILD

The first version of this repository is `1.0.0+1`.

| Part | Increments when |
|---|---|
| MAJOR | The save format changes in a way that older saves cannot be migrated through. |
| MINOR | A feature, an asset set or a screen is added. |
| PATCH | A bug is fixed, a document is corrected, or code is refactored with no behaviour change. |
| BUILD | Every single version change, without exception. BUILD never resets. |

BUILD is a monotonic counter across the life of the repository. If MAJOR, MINOR or
PATCH changes, BUILD changes too. BUILD may also advance on its own only if a rebuild
is published with no source change, which has not happened so far.

## Where the version is stated

The same version string appears in all of these, and they must agree:

| Location | Form |
|---|---|
| `package.json` `version` field | `1.0.0` plus build metadata, see note below |
| `src/core/version.js` | The full string including `+BUILD`, used by the in-game about panel |
| `CHANGELOG.md` head entry | The full string |
| `README.md` version line | The full string |

Note on `package.json`: npm accepts build metadata after a plus sign, so the field
carries the full `1.0.0+1` form. The test suite asserts that every location above
agrees, so a partial bump fails the build rather than drifting quietly.

## Procedure for a version change

Every commit that changes anything shipped follows this order, with no step merged
into another and none skipped:

1. Linter clean and tests green.
2. Bump the version in every location listed above.
3. Write the CHANGELOG entry. It ships in the same commit as the change it describes.
4. Stage.
5. Commit using the message contract below.
6. Push.

## Commit message contract

    <type>: <what changed, in plain language> - v<version>

    <why it changed, one or two sentences>
    <what was validated, and how>

Types in use: Feature, Fix, Refactor, Documentation, Logging, Structural, Asset, Test.

## Conflict on record

The owner's shared governance pack mandates a two part `vX.Y` scheme and ships a
`bump-version.ps1` that rejects anything else. This repository has not adopted the
governance pack (see `docs/DECISIONS.md`, decision D-002) and uses the four part
scheme above, matching the owner's other active projects. The governance script is
never run against this repository.
