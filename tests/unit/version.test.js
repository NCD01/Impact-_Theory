/**
 * version.test.js
 *
 * Covers: that the one version number is the same in every file that states one.
 *
 * `docs/VERSIONING.md` promises that a partial bump fails the build rather than drifting
 * quietly. This is the file that keeps that promise. Without it the promise is a claim
 * about a test that does not exist, which is worse than no promise at all.
 *
 * The locations checked are package.json, src/core/version.js, the head of CHANGELOG.md
 * and the version line in README.md.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSION, GAME_NAME } from '../../src/core/version.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');

/** MAJOR.MINOR.PATCH+BUILD, as defined in docs/VERSIONING.md. */
const FORMAT = /^(\d+)\.(\d+)\.(\d+)\+(\d+)$/;

describe('one version number, true everywhere', () => {
  it('src/core/version.js uses the documented format', () => {
    expect(VERSION).toMatch(FORMAT);
  });

  it('package.json agrees with src/core/version.js', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.version).toBe(VERSION);
  });

  it('the changelog head entry is the current version', () => {
    const changelog = read('CHANGELOG.md');
    // The newest entry is the first "## v..." heading in the file.
    const head = changelog.match(/^## v(\S+)/m);
    expect(head, 'no version heading found in CHANGELOG.md').not.toBeNull();
    expect(head[1]).toBe(VERSION);
  });

  it('the README states the current version', () => {
    const readme = read('README.md');
    expect(
      readme.includes(VERSION),
      `README.md does not mention ${VERSION}. Update its version line.`,
    ).toBe(true);
  });

  it('names the game consistently', () => {
    expect(GAME_NAME).toBe('Impact Theory');
    expect(read('README.md').startsWith('# Impact Theory')).toBe(true);
  });
});

describe('changelog discipline', () => {
  const changelog = read('CHANGELOG.md');

  it('has an entry for every version heading, newest first', () => {
    const versions = [...changelog.matchAll(/^## v(\d+)\.(\d+)\.(\d+)\+(\d+)/gm)]
      .map((m) => Number(m[4]));
    expect(versions.length).toBeGreaterThan(1);
    // BUILD is a monotonic counter, so reading down the file it must strictly decrease.
    for (let i = 1; i < versions.length; i += 1) {
      expect(versions[i], `build numbers out of order at entry ${i}`)
        .toBeLessThan(versions[i - 1]);
    }
  });

  it('gives every entry a validation evidence line', () => {
    // The rule is that a claim with no evidence behind it is not a claim this project
    // makes. A missing line means an entry asserting work nobody can check.
    const entries = changelog.split(/^## v/m).slice(1);
    for (const entry of entries) {
      const heading = entry.split('\n')[0];
      expect(entry, `entry "${heading}" has no Validation Evidence line`)
        .toMatch(/\*\*Validation Evidence:\*\*/);
    }
  });

  it('names an author and a type in every entry', () => {
    const entries = changelog.split(/^## v/m).slice(1);
    for (const entry of entries) {
      const heading = entry.split('\n')[0];
      expect(entry, `entry "${heading}" has no author`).toMatch(/\*\*Author:\*\*/);
      expect(heading, `entry "${heading}" has no type`)
        .toMatch(/- (Feature|Fix|Refactor|Documentation|Logging|Structural|Asset|Test)$/);
    }
  });
});
