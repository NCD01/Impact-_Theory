/**
 * version.js
 *
 * OWNS: the version string the running game reports, in the about panel and in the
 * console banner.
 *
 * MUST NOT OWN: the versioning rules. Those are in docs/VERSIONING.md, which is the one
 * file that states the scheme.
 *
 * This string and the `version` field of package.json must agree. The unit suite
 * asserts that they do, so a half finished bump fails the tests rather than shipping.
 */

/** Full version including build metadata. Format: MAJOR.MINOR.PATCH+BUILD. */
export const VERSION = '1.7.0+11';

/** Human readable name, used in the title and the about panel. */
export const GAME_NAME = 'Impact Theory';
