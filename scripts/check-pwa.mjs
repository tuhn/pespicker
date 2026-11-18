// PWA self-check: serve dist/ on http://localhost (a secure context, like the https deploy), then
//  1. ask Chrome (CDP Page.getInstallabilityErrors) whether the app is installable,
//  2. wait for the service worker to control the page,
//  3. go offline and reload: the app must still render.
//   npm run build && npm run check:pwa
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './lib/paths.mjs';

const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const fail = (m) => { console.error('FAIL', m); process.exitCode = 1; };

await page.goto(url);
await page.waitForSelector('#draw-btn');
const cdp = await ctx.newCDPSession(page);
await page.waitForTimeout(500);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
if (installabilityErrors.length) fail(`not installable: ${JSON.stringify(installabilityErrors)}`);
else console.log('ok  installable (no installability errors)');

const manifest = await cdp.send('Page.getAppManifest');
if (!manifest.url || manifest.errors?.length) fail(`manifest problem: ${JSON.stringify(manifest.errors)}`);
else console.log(`ok  manifest ${manifest.url}`);

const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
  return { scope: reg.scope, controlled: !!navigator.serviceWorker.controller, caches: await caches.keys() };
});
if (!sw.controlled) fail('service worker did not take control'); else console.log(`ok  service worker controls the page, cache ${sw.caches.join(', ')}`);

await ctx.setOffline(true);
await page.reload();
const offlineOk = await page.waitForSelector('#draw-btn', { timeout: 5000 }).then(() => true, () => false);
if (!offlineOk) fail('app does not load offline'); else console.log('ok  loads offline from the service worker cache');
await page.click('#draw-btn');
const drew = await page.waitForSelector('#skip-btn, #redraw-btn', { timeout: 5000 }).then(() => true, () => false);
if (!drew) fail('draw does not start offline'); else console.log('ok  draw works offline');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
await browser.close();
server.close();
