// Download + optimize flags and club crests into src/assets/, then refresh ASSET_SOURCES.md and DATA_REPORT.md.
//
//   npm run fetch:assets
//   npm run fetch:assets -- --no-cache    # re-download crests
//
// Flags: copied from the flag-icons package (4x3 SVG), optimized with svgo. Only the codes used in teams.json.
// Crests: Wikipedia article (teams.json sourceAliases.wikipedia) -> its lead image (page_image_free or
// page_image) -> file URL via imageinfo. SVG is optimized with svgo; if it is still heavier than
// SVG_MAX_BYTES, or the source is raster, it is rendered to a 128px WebP with sharp.
// A crest that fails gets `logo: null` in teams.json and the app falls back to a monogram badge.
import fs from 'node:fs';
import path from 'node:path';
import { optimize } from 'svgo';
import sharp from 'sharp';
import { ROOT, ASSETS_DIR, CACHE_DIR, DATA_DIR, loadTeams, writeJson } from './lib/paths.mjs';
import { writeReport } from './lib/report.mjs';

const SVG_MAX_BYTES = 24 * 1024;
const FLAG_SVG_MAX_BYTES = 16 * 1024;
const RASTER_SIZE = 128;
// Wikimedia's User-Agent policy asks for contact info; anonymous clients get rate limited hard (HTTP 429).
// Override with WIKIMEDIA_CONTACT=you@example.com.
const CONTACT = process.env.WIKIMEDIA_CONTACT || 'dev@tuhoang.app';
const UA = `pespicker-asset-fetcher/1.0 (https://pespicker.tuhoang.app; ${CONTACT}) node-fetch`;
const API = 'https://en.wikipedia.org/w/api.php';
const useCache = !process.argv.includes('--no-cache');

const teams = loadTeams();
const flagsDir = path.join(ASSETS_DIR, 'flags');
const logosDir = path.join(ASSETS_DIR, 'logos');
const dlDir = path.join(CACHE_DIR, 'assets');
for (const d of [flagsDir, logosDir, dlDir]) fs.mkdirSync(d, { recursive: true });

const svgo = (s) => optimize(s, { multipass: true, floatPrecision: 2, plugins: ['preset-default', 'removeDimensions'] }).data;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- flags ----------
const flagSrc = path.join(ROOT, 'node_modules', 'flag-icons', 'flags', '4x3');
const sources = { flags: {}, logos: {}, totals: {} };
const isos = [...new Set(teams.map((t) => t.flagIso).filter(Boolean))].sort();
for (const f of fs.readdirSync(flagsDir)) fs.rmSync(path.join(flagsDir, f));
let flagBytes = 0;
for (const iso of isos) {
  const src = path.join(flagSrc, `${iso}.svg`);
  if (!fs.existsSync(src)) { console.warn('  ! missing flag', iso); continue; }
  const svg = svgo(fs.readFileSync(src, 'utf8'));
  let file, out;
  if (Buffer.byteLength(svg) <= FLAG_SVG_MAX_BYTES) { file = `flags/${iso}.svg`; out = Buffer.from(svg); }
  else {
    // Detailed coats of arms (mx, es, hr, ec) are 30-80 KB as SVG; a 320x240 WebP is plenty for a 512px card.
    file = `flags/${iso}.webp`;
    out = await sharp(Buffer.from(svg), { density: 200 }).resize(320, 240, { fit: 'fill' }).webp({ quality: 88 }).toBuffer();
  }
  fs.writeFileSync(path.join(ASSETS_DIR, file), out);
  flagBytes += out.length;
  sources.flags[iso] = { file, bytes: out.length, source: 'flag-icons@7.6.0 (MIT)' };
}
sources.totals.flags = flagBytes;
console.log(`flags: ${isos.length} files, ${(flagBytes / 1024).toFixed(1)} KB`);

// ---------- crests ----------
async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status}`);
  return res.json();
}

async function download(url, file) {
  if (useCache && fs.existsSync(file)) return fs.readFileSync(file);
  for (let attempt = 1; ; attempt++) {
    await sleep(1500);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && attempt < 6) {
      const wait = (parseInt(res.headers.get('retry-after'), 10) || 5 * attempt) * 1000;
      console.warn(`    429, waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    return buf;
  }
}

const clubs = teams.filter((t) => t.type === 'club');
const titles = clubs.map((t) => t.sourceAliases?.wikipedia).filter(Boolean);
// 1) article -> lead image file name
const pageInfo = await api({ action: 'query', prop: 'pageprops', ppprop: 'page_image|page_image_free', redirects: '1', titles: titles.join('|') });
const resolveTitle = new Map(titles.map((t) => [t, t]));
for (const n of pageInfo.query.normalized || []) resolveTitle.set(n.from, n.to);
for (const r of pageInfo.query.redirects || []) for (const [k, v] of resolveTitle) if (v === r.from) resolveTitle.set(k, r.to);
// An article can have two lead images: page_image (often the non-free crest) and page_image_free
// (sometimes a stadium photo, e.g. RC Lens). Prefer the candidate that looks like a crest:
// an SVG, or a name containing logo/crest/badge/emblem. A photo is never used: no match -> monogram.
const CREST_NAME = /logo|crest|badge|emblem|escudo|wappen|stemma/i;
function pickCrest(pp = {}) {
  const c = [pp.page_image, pp.page_image_free].filter(Boolean);
  return c.find((f) => /\.svg$/i.test(f)) || c.find((f) => CREST_NAME.test(f)) || null;
}
const imageOf = new Map(pageInfo.query.pages.map((p) => [p.title, pickCrest(p.pageprops)]));
// 2) file name -> URL, size, mime, description page
const files = [...new Set([...imageOf.values()].filter(Boolean))];
const fileInfo = new Map();
for (let i = 0; i < files.length; i += 40) {
  const chunk = files.slice(i, i + 40);
  const r = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiextmetadatafilter: 'LicenseShortName', iiurlwidth: '256', titles: chunk.map((f) => `File:${f}`).join('|') });
  const norm = new Map((r.query.normalized || []).map((n) => [n.to, n.from]));
  for (const p of r.query.pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const key = (norm.get(p.title) || p.title).replace(/^File:/, '');
    fileInfo.set(key.replace(/ /g, '_'), ii);
    fileInfo.set(key.replace(/_/g, ' '), ii);
  }
}

let logoBytes = 0;
for (const t of clubs) {
  const article = resolveTitle.get(t.sourceAliases?.wikipedia) || t.sourceAliases?.wikipedia;
  const fileName = imageOf.get(article);
  const ii = fileName && (fileInfo.get(fileName) || fileInfo.get(fileName.replace(/_/g, ' ')));
  const rec = { article: article ? `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, '_'))}` : null, file: null };
  try {
    if (!ii) throw new Error(fileName ? `no imageinfo for ${fileName}` : 'article has no lead image');
    rec.sourceUrl = ii.url;
    rec.descriptionUrl = ii.descriptionurl;
    rec.license = ii.extmetadata?.LicenseShortName?.value || null;
    const ext = path.extname(new URL(ii.url).pathname).toLowerCase();
    for (const old of ['svg', 'webp']) fs.rmSync(path.join(logosDir, `${t.id}.${old}`), { force: true });
    let out, format;
    if (ii.mime === 'image/svg+xml') {
      const raw = (await download(ii.url, path.join(dlDir, `${t.id}${ext}`))).toString('utf8');
      const svg = svgo(raw);
      if (Buffer.byteLength(svg) <= SVG_MAX_BYTES) { out = Buffer.from(svg); format = 'svg'; }
      else { out = await toWebp(Buffer.from(raw), true); format = 'webp'; rec.note = `SVG ${(Buffer.byteLength(svg) / 1024).toFixed(0)} KB sau svgo, đổi sang WebP`; }
    } else {
      const raw = await download(ii.thumburl || ii.url, path.join(dlDir, `${t.id}-thumb${path.extname(new URL(ii.thumburl || ii.url).pathname)}`));
      out = await toWebp(raw, false); format = 'webp';
    }
    const rel = `logos/${t.id}.${format}`;
    fs.writeFileSync(path.join(ASSETS_DIR, rel), out);
    Object.assign(rec, { file: rel, format, bytes: out.length });
    logoBytes += out.length;
    t.logo = rel;
    console.log(`  ${t.id.padEnd(22)} ${format} ${(out.length / 1024).toFixed(1)} KB`);
  } catch (e) {
    rec.error = e.message;
    t.logo = null;
    console.warn(`  ! ${t.id}: ${e.message}`);
  }
  sources.logos[t.id] = rec;
}
sources.totals.logos = logoBytes;

async function toWebp(buf, isSvg) {
  return sharp(buf, isSvg ? { density: 300 } : {})
    .resize(RASTER_SIZE, RASTER_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
}

writeJson(path.join(DATA_DIR, 'teams.json'), teams);
writeJson(path.join(ASSETS_DIR, 'sources.json'), sources);

// ASSET_SOURCES.md
const md = ['# ASSET_SOURCES', '', 'Sinh tự động bởi `npm run fetch:assets`. Dùng cá nhân, không thương mại.', '',
  '## Cờ', '', `Package [flag-icons](https://github.com/lipis/flag-icons) 7.6.0 (MIT), bản 4x3, tối ưu bằng svgo. Mã dùng: ${isos.join(', ')}.`, '',
  '## Logo CLB', '', '| CLB | File | Nguồn | Giấy phép | Ghi chú |', '|---|---|---|---|---|'];
for (const t of clubs) {
  const r = sources.logos[t.id];
  md.push(`| ${t.name} | ${r.file || '—'} | ${r.descriptionUrl ? `[${decodeURIComponent(r.descriptionUrl.split('/').pop())}](${r.descriptionUrl})` : r.error || '—'} | ${r.license || '—'} | ${r.note || ''} |`);
}
fs.writeFileSync(path.join(ROOT, 'ASSET_SOURCES.md'), md.join('\n') + '\n');
writeReport();
console.log(`logos: ${clubs.filter((t) => t.logo).length}/${clubs.length}, ${(logoBytes / 1024).toFixed(1)} KB. ASSET_SOURCES.md + DATA_REPORT.md updated.`);
