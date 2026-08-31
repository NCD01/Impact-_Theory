/**
 * serve-dist.mjs
 *
 * OWNS: serving the production build over plain HTTP for verification.
 *
 * MUST NOT OWN: building. Run `npm run build` first.
 *
 * Why this exists rather than `vite preview`. Vite's preview server carries security
 * middleware that rejects requests carrying `Sec-Fetch-Dest: script`, which is exactly
 * what a browser sends for a module script, so the built game returns 404 for its own
 * bundle under preview while curl fetches it happily. GitHub Pages is a plain static
 * file host with no such middleware, so a plain static server is the closer match and
 * the honest thing to test the deployable artefact against.
 *
 * Run: node scripts/serve-dist.mjs [port]
 * Serves dist/ under the same base path GitHub Pages will use.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PORT = Number(process.argv[2] ?? 4180);
const ROOT = path.resolve(import.meta.dirname, '..', 'dist');
const BASE = '/Impact-_Theory/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (urlPath.startsWith(BASE)) urlPath = urlPath.slice(BASE.length - 1);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const file = path.join(ROOT, urlPath);
  // Refuse anything that escapes the root, which a crafted path could otherwise reach.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`Not found: ${urlPath}`);
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Serving dist/ at http://localhost:${PORT}${BASE}`);
});
