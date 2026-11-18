// Polite page fetcher for fifaindex.com.
//
// Why not plain fetch or a Playwright-launched browser: fifaindex (Cloudflare) rejects
// server-side requests and also blocks browsers launched by Playwright (automation flags,
// navigator.webdriver). Headless Chrome gets a "Just a moment..." challenge. What works
// (tested 2026-11-18) is spawning a normal Chrome window ourselves and attaching Playwright
// over CDP. So the default is a visible ("headed") window; --headless is opt-in.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CACHE_DIR } from './paths.mjs';

const HTML_CACHE = path.join(CACHE_DIR, 'html');
const MIN_INTERVAL_MS = 2000;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // Playwright's bundled Chromium, spawned by us (no automation flags) also works.
  return chromium.executablePath();
}

export async function openBrowser({ headless = false, port = 9333 } = {}) {
  fs.mkdirSync(HTML_CACHE, { recursive: true });
  const profile = path.join(CACHE_DIR, 'chrome-profile');
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...(headless ? ['--headless=new'] : []),
    'about:blank',
  ];
  const proc = spawn(findChrome(), args, { stdio: 'ignore' });
  let browser;
  for (let i = 0; i < 20 && !browser; i++) {
    await sleep(500);
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { /* retry */ }
  }
  if (!browser) { proc.kill(); throw new Error('Could not connect to Chrome over CDP'); }
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || (await ctx.newPage());
  let last = 0;

  async function get(url, { useCache = true } = {}) {
    const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
    const file = path.join(HTML_CACHE, `${key}.html`);
    if (useCache && fs.existsSync(file)) return { html: fs.readFileSync(file, 'utf8'), fetchedAt: fs.statSync(file).mtime.toISOString(), cached: true };
    const wait = last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Give a Cloudflare interstitial a chance to resolve on its own (or be solved by the user).
    for (let i = 0; i < 30 && /Just a moment|Attention Required/i.test(await page.title()); i++) {
      if (i === 0) console.warn('  Cloudflare check on', url, '- waiting (solve it in the window if asked)');
      await sleep(2000);
    }
    const title = await page.title();
    if (/Just a moment|Attention Required/i.test(title) || (res && res.status() >= 400 && !/FIFA Index/.test(title))) {
      throw new BlockedError(`Blocked on ${url} (status ${res?.status()}, title "${title}")`);
    }
    const html = await page.content();
    fs.writeFileSync(file, html);
    return { html, fetchedAt: new Date().toISOString(), cached: false };
  }

  async function close() {
    try { await browser.close(); } catch { /* ignore */ }
    proc.kill();
  }
  return { get, close };
}

export class BlockedError extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
