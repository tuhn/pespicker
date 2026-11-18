// Contact sheet of every flag and crest on the app's dark background, for eyeballing assets.
//   node scripts/preview-assets.mjs   -> .cache/assets-preview.html + screenshots/assets-preview.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, ASSETS_DIR, CACHE_DIR, loadTeams } from './lib/paths.mjs';

const teams = loadTeams();
const mime = (f) => (f.endsWith('.svg') ? 'image/svg+xml' : 'image/webp');
const dataUri = (rel) => {
  const p = path.join(ASSETS_DIR, rel);
  return fs.existsSync(p) ? `data:${mime(p)};base64,${fs.readFileSync(p).toString('base64')}` : null;
};
const flagFile = (iso) => ['svg', 'webp'].map((e) => `flags/${iso}.${e}`).find((r) => fs.existsSync(path.join(ASSETS_DIR, r)));

const cell = (t) => {
  const img = t.type === 'club' ? (t.logo ? dataUri(t.logo) : null) : dataUri(flagFile(t.flagIso) || '');
  const badge = `<div class="mono" style="background:${t.colors[0]};color:${t.colors[1]}">${t.shortName}</div>`;
  return `<figure><div class="img ${t.type}">${img ? `<img src="${img}">` : badge}</div><figcaption>${t.name}${t.type === 'club' && !t.logo ? ' <b>(no logo)</b>' : ''}</figcaption></figure>`;
};
const html = `<!doctype html><meta charset="utf-8"><style>
body{background:#07130f;color:#f3fff8;font:12px system-ui;margin:16px}
h2{color:#78ff9a;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,96px);gap:10px}
figure{margin:0;text-align:center}
.img{height:64px;display:flex;align-items:center;justify-content:center;background:#0d2119;border:1px solid #1d3a2e;border-radius:6px}
.img img{max-width:84px;max-height:56px}
.mono{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
figcaption{margin-top:4px;color:#a8b9b0}b{color:#ff8a8a}
</style><h2>National (${teams.filter((t) => t.type === 'national').length})</h2><div class="grid">${teams.filter((t) => t.type === 'national').map(cell).join('')}</div>
<h2>Clubs (${teams.filter((t) => t.type === 'club').length})</h2><div class="grid">${teams.filter((t) => t.type === 'club').map(cell).join('')}</div>`;
const out = path.join(CACHE_DIR, 'assets-preview.html');
fs.writeFileSync(out, html);
fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
await p.goto('file:///' + out.replace(/\\/g, '/'));
await p.screenshot({ path: path.join(ROOT, 'screenshots', 'assets-preview.png'), fullPage: true });
await b.close();
console.log('screenshots/assets-preview.png');
