/**
 * vite.config.js
 *
 * OWNS: dev server, build and unit test configuration.
 *
 * MUST NOT OWN: any game tuning value. Those live in src/core/constants.js.
 *
 * The `base` path matters. GitHub Pages serves a project site from
 * https://<user>.github.io/<repo>/, so every asset URL needs that prefix in a
 * production build and must not have it during local development.
 */

import { defineConfig } from 'vite';

/**
 * The repository name, which is also the GitHub Pages sub path.
 * Deliberately not read from package.json: the npm package name is `impact-theory`
 * while the GitHub repository is `Impact-_Theory`, with an underscore, and the URL
 * follows the repository.
 */
const PAGES_BASE = '/Impact-_Theory/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PAGES_BASE : '/',
  build: {
    outDir: 'dist',
    // Rapier ships a WebAssembly module. Leaving assetsInlineLimit at its default
    // would inline small assets as base64; the wasm is far above the limit so it is
    // emitted as a file, which is what we want for caching.
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // The master working copy lives on an SMB network share. Windows cannot deliver
      // native change notifications across it, and chokidar's default watcher dies with
      // "UNKNOWN: unknown error, watch" the moment the server starts. Polling is the
      // documented fallback for network filesystems. The interval is loose on purpose:
      // this project has a few dozen source files and nothing needs sub-second reload.
      usePolling: true,
      interval: 600,
      binaryInterval: 1500,
      ignored: ['**/node_modules/**', '**/.git/**', '**/_source/**', '**/Assets/**', '**/.agent_temp/**'],
    },
  },
  test: {
    // Node environment. The unit suite covers scoring, save migration, level schema
    // validation and block manifest conformance, none of which need a DOM.
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    reporters: ['default'],
  },
}));
