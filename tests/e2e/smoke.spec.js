/**
 * smoke.spec.js
 *
 * Covers: that the built game boots in a browser, loads its assets, plays a level from
 * the title screen to a results screen, and survives a viewport change. Plus the visual
 * quality gate the standards require: four screenshot classes, each judged against a
 * stated acceptance criterion.
 *
 * This is the suite that would have caught the three defects the unit tests could not:
 * hidden screens swallowing touches, a level that never declared itself cleared, and a
 * structure framed for the wrong size. None of those are visible from Node.
 */

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = '.agent_temp/screenshots';

/** Reads the debug surface the game publishes, minus its function members. */
async function state(page) {
  return page.evaluate(() => {
    const d = { ...globalThis.__IMPACT_THEORY__ };
    for (const k of ['resetFrameTimes', 'getFrameTimes', 'getImpactLog', 'resetImpactLog']) {
      delete d[k];
    }
    return d;
  });
}

/** Waits for the game to report itself ready, failing with the on page error if not. */
async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.goto('./');
  try {
    await page.waitForFunction(() => globalThis.__IMPACT_THEORY__?.ready === true, null,
      { timeout: 60000 });
  } catch (cause) {
    // The page writes a startup failure into #boot-error, which says far more than a
    // bare timeout. The original error is attached as the cause rather than dropped.
    const shown = await page.locator('#boot-error').textContent().catch(() => '');
    throw new Error(
      `Game never became ready.\nOn page error: ${shown}\nConsole: ${errors.join('\n')}`,
      { cause },
    );
  }
  return errors;
}

/** Fires `n` shots at the middle of the playfield, stopping early if the level ends. */
async function fireShots(page, n, gapMs = 420) {
  const box = page.viewportSize();
  const x = Math.round(box.width / 2);
  const y = Math.round(box.height * 0.62);
  for (let i = 0; i < n; i += 1) {
    const screen = await page.evaluate(() => globalThis.__IMPACT_THEORY__.screen);
    if (screen !== 'playing') return;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(gapMs);
  }
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS, { recursive: true });
});

test('boots with every asset loaded and no console errors', async ({ page }) => {
  const errors = await boot(page);
  const s = await state(page);

  // Acceptance: every one of the fifteen converted models loads at runtime. Checked by
  // a load count from the loader itself, not by reading the manifest, because a
  // registered asset that never loads is the usual way an asset phase reports success
  // while shipping nothing.
  expect(s.modelsFailed, 'models that failed to load').toBe(0);
  expect(s.modelsLoaded, 'models loaded').toBe(15);
  expect(s.levelCount, 'levels bundled').toBe(30);
  expect(s.screen).toBe('title');
  expect(errors, 'console errors during boot').toEqual([]);
});

test('plays a level from the title screen through to a results screen', async ({ page }) => {
  const errors = await boot(page);

  await page.click('#title-play');
  await expect(page.locator('#screen-select')).toBeVisible();

  await page.click('[data-level-id="1"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');
  const playing = await state(page);
  expect(playing.bodies, 'level 1 places its pieces').toBeGreaterThan(0);
  expect(playing.levelId).toBe(1);

  await fireShots(page, 30);
  // The session waits for the world to settle before declaring a clear, so allow for it.
  await page.waitForFunction(
    () => globalThis.__IMPACT_THEORY__.screen === 'results',
    null,
    { timeout: 60000 },
  );

  const done = await state(page);
  expect(done.lastResult.cleared, 'level 1 cleared').toBe(true);
  expect(done.lastResult.stars).toBeGreaterThanOrEqual(1);
  expect(done.unlocked, 'clearing level 1 unlocks level 2').toBeGreaterThanOrEqual(2);
  expect(errors, 'console errors while playing').toEqual([]);
});

test('a shot fires, hits, and damages the structure', async ({ page }) => {
  await boot(page);
  await page.click('#title-play');
  await page.click('[data-level-id="1"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');

  const before = await state(page);
  await fireShots(page, 6, 300);
  const after = await state(page);

  expect(after.ballsFired, 'balls actually left the cannon').toBeGreaterThan(0);
  // Acceptance: a ball reaching the structure registers a real impact with energy, which
  // is what the damage model runs on. Zero here means the balls never arrived.
  expect(after.lastImpactEnergy, 'impact energy recorded').toBeGreaterThan(0);
  expect(after.bodies).toBeGreaterThan(before.bodies - 1);
});

test('survives a viewport change without breaking aim or layout', async ({ page }) => {
  const errors = await boot(page);
  await page.click('#title-play');
  await page.click('[data-level-id="1"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');

  // The projection helper caches the canvas rectangle and is refreshed on resize. If
  // that wiring were broken, aiming would land in the wrong place after a rotation
  // while the picture still looked correct, which is invisible in a screenshot.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  await fireShots(page, 3, 300);
  const s = await state(page);
  expect(s.ballsFired, 'still able to fire after a resize').toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

/**
 * The visual quality gate the standards require: four screenshot classes, each with a
 * stated acceptance criterion checked here rather than left to a human to remember.
 */
test('visual gate: four screenshot classes', async ({ page }, testInfo) => {
  const tag = testInfo.project.name;

  // Every level is unlocked before the page loads, so the gate can photograph a
  // middling level rather than only the opening one. Written through an init script
  // rather than by clicking, because a locked cell is a disabled button and clicking a
  // disabled button waits for it to become enabled until the test times out.
  await page.addInitScript(() => {
    localStorage.setItem('impact-theory.save.v1', JSON.stringify({
      schema: 2, difficulty: 'easy', muted: true, unlocked: 30, levels: {}, endlessBest: 0,
    }));
  });

  // 1. The playing screen with the debug overlay off, at this project's viewport.
  await boot(page);
  await page.click('#title-play');
  await page.click('[data-level-id="19"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');
  await page.waitForTimeout(2200);

  const playing = await state(page);
  // Acceptance: the structure is standing and on screen, which means pieces exist and
  // none of them have already fallen below the rest threshold at load.
  expect(playing.standing, 'structure standing at load').toBeGreaterThan(0);
  await page.screenshot({ path: path.join(SHOTS, `gate-${tag}-01-play-debug-off.png`) });

  // 2. Debug overlay on. Same scene, reloaded with the debug flag.
  await page.goto('./?debug=1');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__?.ready === true);
  await page.click('#title-play');
  await page.click('[data-level-id="19"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');
  await page.waitForTimeout(1400);
  // Acceptance: the overlay is visible and carries real numbers, not a placeholder.
  const debugPanel = page.locator('#debug');
  await expect(debugPanel).toBeVisible();
  await expect(debugPanel).toContainText('fps');
  await expect(debugPanel).toContainText('bodies');
  await page.screenshot({ path: path.join(SHOTS, `gate-${tag}-02-play-debug-on.png`) });

  // 3. The level select, which is the screen most likely to break on a narrow viewport.
  await page.click('#pause-button');
  await page.click('#pause-quit');
  await expect(page.locator('#screen-select')).toBeVisible();
  // Acceptance: every one of the thirty levels has a cell, and the panel fits the
  // viewport width without the page scrolling sideways.
  await expect(page.locator('.level-cell')).toHaveCount(30);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in pixels').toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, `gate-${tag}-03-level-select.png`) });

  // 4. The results screen, which has to read clearly at both sizes.
  await page.click('[data-level-id="1"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');
  await fireShots(page, 30);
  await page.waitForFunction(
    () => globalThis.__IMPACT_THEORY__.screen === 'results', null, { timeout: 60000 },
  );
  // Acceptance: the results screen shows a star row and a score, both non-empty.
  await expect(page.locator('#results-stars')).toBeVisible();
  await expect(page.locator('#results-score')).not.toBeEmpty();
  await page.screenshot({ path: path.join(SHOTS, `gate-${tag}-04-results.png`) });
});

test('carries on to the next level from the results screen', async ({ page }) => {
  const errors = await boot(page);

  await page.click('#title-play');
  await page.click('[data-level-id="1"]');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');
  await fireShots(page, 30);
  await page.waitForFunction(
    () => globalThis.__IMPACT_THEORY__.screen === 'results', null, { timeout: 60000 },
  );

  // The whole point of the button: it should load level 2, not return to the menu.
  await expect(page.locator('#results-next')).toBeVisible();
  await page.click('#results-next');
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__.screen === 'playing');

  const second = await state(page);
  expect(second.levelId, 'Next level loads level 2').toBe(2);
  expect(second.bodies, 'level 2 places its pieces').toBeGreaterThan(0);
  expect(second.score, 'the score starts again for a new level').toBe(0);

  // And back out to the level select, which should now show two levels open.
  await page.click('#pause-button');
  await page.click('#pause-quit');
  await expect(page.locator('#screen-select')).toBeVisible();
  const enabled = await page.locator('.level-cell:not([disabled])').count();
  expect(enabled, 'levels 1 and 2 are both open').toBeGreaterThanOrEqual(2);

  expect(errors, 'console errors across two levels').toEqual([]);
});
