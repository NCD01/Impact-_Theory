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
import wasm from 'vite-plugin-wasm';

/**
 * The repository name, which is also the GitHub Pages sub path.
 * Deliberately not read from package.json: the npm package name is `impact-theory`
 * while the GitHub repository is `Impact-_Theory`, with an underscore, and the URL
 * follows the repository.
 */
const PAGES_BASE = '/Impact-_Theory/';

export default defineConfig(({ command }) => ({
  // Rapier's standard build ships its WebAssembly as a real .wasm file with an ESM
  // integration wrapper. These two plugins let the bundler emit it as a separate asset
  // instead of a base64 string. That matters: the compat build inlines the same 2 MB
  // module as 2.57 MB of base64, which is 73 percent of the bundle and compresses badly,
  // because base64 destroys the byte patterns gzip relies on.
  // Top level await is used by the wasm wrapper and is supported natively by every
  // browser that supports WebAssembly ESM integration, so no transform plugin is needed
  // at the es2022 target this project builds for.
  plugins: [wasm()],
  base: command === 'build' ? PAGES_BASE : '/',
  build: {
    outDir: 'dist',
    // Rapier ships a WebAssembly module. Leaving assetsInlineLimit at its default
    // would inline small assets as base64; the wasm is far above the limit so it is
    // emitted as a file, which is what we want for caching.
    target: 'es2022',
    // No source map in the production build. It was 6.3 MB, larger than the bundle, and
    // it is deployed to a public page for a child to open on a phone. Development builds
    // still have full source mapping.
    sourcemap: false,
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
