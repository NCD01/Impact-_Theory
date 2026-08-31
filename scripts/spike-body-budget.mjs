/**
 * spike-body-budget.mjs
 *
 * OWNS: the repeatable measurement behind the body budget decision (D-006).
 *
 * MUST NOT OWN: the decision itself, which is written down in docs/DECISIONS.md. This
 * script produces numbers; the decision interprets them.
 *
 * Run it with a dev server already up on port 5173:
 *   npm run dev
 *   node scripts/spike-body-budget.mjs
 * Environment: COUNTS (comma separated piece counts), SAMPLES, CPU_THROTTLE.
 *
 * Measures sustained frame rate while N real pieces are live and moving, and reports
 * frame rate against the number of bodies actually in the world at the time, rather
 * than against the number the level started with. The first version of this harness
 * sampled only at the end of the window, by which time the wall had collapsed and every
 * fragment had despawned, so it reported a flat 60 fps at every piece count.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const URL = 'http://localhost:5173/';
const CPU_THROTTLE = Number(process.env.CPU_THROTTLE ?? 4);
const SAMPLE_MS = 250;
const SAMPLES = Number(process.env.SAMPLES ?? 40); // 40 x 250 ms = 10 s
const COUNTS = (process.env.COUNTS ?? '20,40,60,80,110,150').split(',').map(Number);

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'],
});

const results = [];
/** Every (bodies, frame time) pair from every run, pooled for bucketing. */
const allSamples = [];
let rendererString = 'unknown';

for (const n of COUNTS) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${URL}?stress=${n}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => globalThis.__IMPACT_THEORY__?.ready === true, { timeout: 120000 });

  if (rendererString === 'unknown') {
    rendererString = await page.evaluate(() => {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    });
  }

  // Let the wall settle so the starting state is a standing structure, not a spawn.
  await page.waitForTimeout(2500);
  const settled = await page.evaluate(() => ({
    bodies: globalThis.__IMPACT_THEORY__.bodies,
    standing: globalThis.__IMPACT_THEORY__.standing,
  }));

  // Knock it down. The collapse is the expensive moment and the one the budget is for.
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.move(195, 500);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
  }

  // Sample frame time and body count together, so frame rate can be attributed to the
  // number of bodies that were actually live at that moment.
  const samples = [];
  await page.evaluate(() => globalThis.__IMPACT_THEORY__.resetFrameTimes());
  for (let s = 0; s < SAMPLES; s += 1) {
     
    await page.waitForTimeout(SAMPLE_MS);
     
    const row = await page.evaluate(() => {
      const d = globalThis.__IMPACT_THEORY__;
      const t = d.getFrameTimes();
      d.resetFrameTimes();
      const mean = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
      return { bodies: d.bodies, fragments: d.fragments, frames: t.length, meanMs: mean };
    });
    samples.push(row);
  }

  const peakBodies = Math.max(...samples.map((x) => x.bodies), settled.bodies);
  for (const x of samples) allSamples.push({ requested: n, bodies: x.bodies, meanMs: x.meanMs, frames: x.frames });

  const row = {
    requestedPieces: n,
    settledBodies: settled.bodies,
    peakBodies,
    samples: samples.length,
    frozenSamples: samples.filter((x) => x.frames === 0).length,
    errors: errors.length,
    errorText: errors.slice(0, 2),
  };
  results.push(row);
  console.log(JSON.stringify(row));

  await ctx.close();
}

await browser.close();
// Frame rate as a function of the number of bodies live at that moment, which is the
// question the budget actually asks. Pooling every sample from every run gives far more
// data per bucket than treating each run's starting piece count as one data point.
const BUCKETS = [0, 25, 50, 75, 100, 125, 150, 200, 300, 1e9];
const byBodies = [];
for (let i = 0; i < BUCKETS.length - 1; i += 1) {
  const lo = BUCKETS[i];
  const hi = BUCKETS[i + 1];
  const inBucket = allSamples.filter((x) => x.bodies >= lo && x.bodies < hi && x.frames > 0);
  if (inBucket.length < 3) continue;
  const msList = inBucket.map((x) => x.meanMs).sort((a, b) => a - b);
  const mean = msList.reduce((a, b) => a + b, 0) / msList.length;
  const p95 = msList[Math.floor(msList.length * 0.95)] ?? msList[msList.length - 1];
  byBodies.push({
    bodies: hi > 1e8 ? `${lo}+` : `${lo}-${hi - 1}`,
    samples: inBucket.length,
    meanFps: +(1000 / mean).toFixed(1),
    p95WorstFps: +(1000 / p95).toFixed(1),
  });
}
console.log('Frame rate against live body count:');
for (const b of byBodies) {
  console.log(`  bodies ${String(b.bodies).padEnd(8)} n=${String(b.samples).padStart(4)}  mean ${String(b.meanFps).padStart(5)} fps   p95 worst ${String(b.p95WorstFps).padStart(5)} fps`);
}

const out = {
  frameRateByLiveBodyCount: byBodies,
  measuredAt: new Date().toISOString(),
  renderer: rendererString,
  cpuThrottleRate: CPU_THROTTLE,
  viewport: '390x844 CSS px at device pixel ratio 2, Chromium mobile emulation',
  method: 'settle, knock down with 8 shots, then sample frame time and body count every '
    + `${SAMPLE_MS} ms for ${(SAMPLES * SAMPLE_MS) / 1000} s; only samples taken while `
    + 'bodies were at or above 60 percent of peak are counted',
  criterion: 'sustained mean fps while the world is loaded, target 45',
  results,
};
fs.mkdirSync('.agent_temp/diagnostics', { recursive: true });
fs.writeFileSync('.agent_temp/diagnostics/body-budget-spike.json', `${JSON.stringify(out, null, 2)}\n`);
console.log('\nrenderer:', rendererString, '| cpu throttle:', `${CPU_THROTTLE}x`);
