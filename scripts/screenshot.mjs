// Self-check screenshots of dist/index.html (file://, offline) at 390x844 and 360x780.
//   npm run screenshot                 # 3D path (WebGL) + 2D fallback path (?no3d)
//   npm run screenshot -- --no-webgl   # launch Chromium with WebGL disabled: must fall back to 2D
//   npm run screenshot -- --mode club  # pool mode to draw from (national | club | mixed)
// Output: screenshots/<path>-<viewport>-<step>.png. Fails on any console error or network request.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT } from './lib/paths.mjs';

const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const noWebgl = argv.includes('--no-webgl');
const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'mixed';
const seed = argv.includes('--seed') ? argv[argv.indexOf('--seed') + 1] : '7';
const base = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const viewports = [[390, 844], [360, 780]];
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const variants = (noWebgl ? [['nogl', '']] : [['3d', ''], ['2d', '&no3d']]).filter(([v]) => !only || v === only);
const problems = [];
const MODE_LABEL = { national: 'National', club: 'Clubs', mixed: 'Mixed' };

const browser = await chromium.launch({ args: noWebgl ? ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] : [] });
for (const [variant, q] of variants) {
  for (const [w, hgt] of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${variant} ${w}: console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`${variant} ${w}: pageerror: ${e.message}`));
    page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) problems.push(`${variant} ${w}: network: ${r.url()}`); });
    const shot = (name) => page.screenshot({ path: path.join(OUT, `${variant}-${w}x${hgt}-${name}.png`) });
    const is3d = async () => page.evaluate(() => document.body.classList.contains('mode3d'));

    await page.goto(`${base}?seed=${seed}${q}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click(`[role=tab]:has-text("${MODE_LABEL[mode]}")`);
    await page.fill('input[aria-label="Player 1 name"]', 'Nam');
    await page.fill('input[aria-label="Player 2 name"]', 'Minh');
    await page.waitForTimeout(400); // let the scene initialise after first paint
    await shot('1-setup');
    await page.click('#draw-btn');
    await page.waitForTimeout(450);
    await shot('2-boot');
    await page.waitForTimeout(1300);
    await shot('3-card-reveal');
    await page.waitForTimeout(3000);
    await shot('4-clash');
    await page.waitForSelector('#redraw-btn', { timeout: 20000 });
    await page.waitForTimeout(500);
    await shot('5-results');
    if (variant !== 'nogl' && variant === '3d' && !(await is3d())) problems.push(`${variant} ${w}: expected the 3D path`);
    if (variant !== '3d' && (await is3d())) problems.push(`${variant} ${w}: expected the 2D fallback`);
    // Lock P1, redraw P2 only
    await page.locator('.lock-btn').first().click();
    await page.click('#redraw-btn');
    await page.waitForTimeout(1500);
    await shot('6-redraw-one-side');
    await page.waitForSelector('#redraw-btn', { timeout: 20000 });
    await page.waitForTimeout(500);
    await shot('7-redraw-done');
    if (variant === '3d') {
      await page.locator('.card-anchor').first().click();
      await page.waitForTimeout(900);
      await shot('8-zoom');
      await page.click('.zoom-catcher');
      await page.waitForTimeout(300);
    }
    await page.click('button[aria-label="History"]');
    await page.waitForTimeout(250);
    await shot('9-history');
    // Regression: Back to Setup, then Draw again must play the full sequence and reach the results.
    await page.keyboard.press('Escape');
    await page.click('button[aria-label="Back to setup"]');
    await page.waitForSelector('#draw-btn');
    await page.click('#draw-btn');
    await page.waitForTimeout(1900);
    await shot('10-draw-again-reveal');
    const reached = await page.waitForSelector('#redraw-btn', { timeout: 20000 }).then(() => true, () => false);
    if (!reached) problems.push(`${variant} ${w}: draw after Back never reached the results (animation stuck)`);
    await page.waitForTimeout(400);
    await shot('11-draw-again-results');
    await ctx.close();
  }
}
await browser.close();
console.log(`screenshots -> ${path.relative(ROOT, OUT)}/`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
