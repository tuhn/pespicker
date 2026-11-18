// Performance run: Playwright + CDP, viewport 390x844, CPU throttle 4x.
// Records every animation frame during (1) the full Draw sequence and (2) a one-side Redraw, then
// reports average fps, p95 frame time and the longest frame. Also screenshots boot / card reveal /
// clash / results, and the scene's draw calls, triangles and texture memory.
//
//   npm run build && npm run perf                 # hardware GPU via ANGLE if available
//   npm run perf -- --swiftshader                 # software GL (worst case)
//   npm run perf -- --parts stadium               # measure only the stadium (no cards / clash)
//
// Note: this is a desktop proxy. CLAUDE.md requires a real Android check too (use ?debug=1 HUD).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT } from './lib/paths.mjs';

const argv = process.argv.slice(2);
const sw = argv.includes('--swiftshader');
const throttle = Number(argv.includes('--cpu') ? argv[argv.indexOf('--cpu') + 1] : 4);
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href + '?seed=11&debug=1';
const args = sw ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

const browser = await chromium.launch({ args });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__frames = [];
  window.__rec = false;
  const loop = (t) => { if (window.__rec) window.__frames.push(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
const cdp = await ctx.newCDPSession(page);
await page.goto(url);
await page.evaluate(() => { localStorage.clear(); });
await page.reload();
await page.waitForTimeout(800);
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? 'unknown' : 'no webgl2';
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

async function record(label, action, shots = []) {
  await page.evaluate(() => { window.__frames = []; window.__rec = true; });
  const t0 = Date.now();
  await action();
  for (const [ms, name] of shots) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(OUT, `perf-${name}.png`) });
  }
  await page.waitForSelector('#redraw-btn', { timeout: 30000 });
  const frames = await page.evaluate(() => { window.__rec = false; return window.__frames; });
  const dts = frames.slice(1).map((t, i) => t - frames[i]).filter((d) => d > 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const avg = dts.reduce((s, d) => s + d, 0) / dts.length;
  const res = {
    label,
    frames: dts.length,
    durationMs: Math.round(frames[frames.length - 1] - frames[0]),
    avgFps: +(1000 / avg).toFixed(1),
    p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    maxMs: +sorted[sorted.length - 1].toFixed(1),
    over50ms: dts.filter((d) => d > 50).length,
    long: frames.slice(1).map((t, i) => [Math.round(frames[i] - frames[0]), Math.round(t - frames[i])]).filter(([, d]) => d > 34),
  };
  console.log(JSON.stringify(res));
  return res;
}

const results = [];
// Measured runs take no screenshots (a screenshot stalls the page and would show up as a long frame).
results.push(await record('full draw', () => page.click('#draw-btn')));
await page.waitForTimeout(600);
const info = await page.evaluate(() => window.__scene?.info());
await page.screenshot({ path: path.join(OUT, 'perf-results.png') });
await page.locator('.lock-btn').first().click();
results.push(await record('redraw one side', () => page.click('#redraw-btn')));
// Screenshot pass (not measured): back to setup, draw again, capture key moments.
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.locator('.lock-btn').first().click();
await page.click('button[aria-label="Back to setup"]');
for (const [ms, name] of [[380, 'boot'], [1750, 'card-reveal'], [4560, 'clash']]) {
  await page.reload();
  await page.waitForTimeout(800);
  await page.click('#draw-btn');
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `perf-${name}.png`) });
}
await browser.close();

const report = { date: new Date().toISOString(), gpu, cpuThrottle: throttle, viewport: '390x844@2x', scene: info, results, errors };
fs.writeFileSync(path.join(ROOT, '.cache', 'perf.json'), JSON.stringify(report, null, 2));
console.log('GPU:', gpu);
console.log('scene:', JSON.stringify(info));
if (errors.length) { console.error(errors); process.exit(1); }
