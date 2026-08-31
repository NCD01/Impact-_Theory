/**
 * playwright.config.js
 *
 * OWNS: how the browser smoke tests are run, and the server they run against.
 *
 * MUST NOT OWN: what the tests assert. That is in tests/e2e/.
 *
 * The suite runs against the production build served by scripts/serve-dist.mjs, not
 * against the dev server. Two reasons. The deployable artefact is the thing worth
 * testing, and `vite preview` cannot serve this build at all: it rejects any request
 * carrying `Sec-Fetch-Dest: script`, which is what a browser sends for a module script.
 * See docs/DECISIONS.md D-011.
 *
 * GPU flags are set deliberately. Headless Chromium defaults to SwiftShader, which
 * software renders everything; screenshots still come out, but any frame rate read from
 * that context is meaningless. With these flags the tests use the real GPU.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;
const BASE = `http://localhost:${PORT}/Impact-_Theory/`;

export default defineConfig({
  testDir: 'tests/e2e',
  // Serial. The tests share one build and one server, and a physics simulation running
  // in four tabs at once on a laptop measures contention rather than the game.
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [['list']],

  use: {
    baseURL: BASE,
    // Screenshots are captured explicitly by the visual gate, so automatic ones would
    // only add noise. A trace on a first retry is worth keeping.
    screenshot: 'off',
    video: 'off',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'],
    },
  },

  projects: [
    {
      name: 'phone-portrait',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop-landscape',
      use: {
        viewport: { width: 1280, height: 720 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1,
      },
    },
  ],

  webServer: {
    // Build first, so the suite always tests current source rather than a stale dist.
    command: `npm run build && node scripts/serve-dist.mjs ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
