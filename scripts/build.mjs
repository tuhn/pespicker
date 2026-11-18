// Build a single self-contained dist/index.html: JS (esbuild bundle, IIFE so it runs from file://),
// CSS, JSON data, flags/crests and the webfont are all inlined. No runtime network access.
//
//   npm run build            -> dist/index.html, prints size and budget check
//   import { buildHtml }     -> used by scripts/dev.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { pathToFileURL } from 'node:url';
import { ROOT, ASSETS_DIR, loadTeams } from './lib/paths.mjs';
import { buildPwaFiles } from './lib/pwa.mjs';

const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const BUDGET = 3 * 1024 * 1024;
const FONT_WEIGHTS = [500, 700];
const FONT_SUBSETS = ['latin', 'latin-ext'];

const mimeOf = (f) => ({ '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' })[path.extname(f).toLowerCase()];
const dataUri = (file) => `data:${mimeOf(file)};base64,${fs.readFileSync(file).toString('base64')}`;

/** Only the flags and crests referenced by teams.json end up in the bundle. */
function assetsModule() {
  const teams = loadTeams();
  const flags = {};
  for (const iso of new Set(teams.map((t) => t.flagIso).filter(Boolean))) {
    const f = ['svg', 'webp'].map((e) => path.join(ASSETS_DIR, 'flags', `${iso}.${e}`)).find((p) => fs.existsSync(p));
    if (f) flags[iso] = dataUri(f);
  }
  const logos = {};
  for (const t of teams) {
    if (!t.logo) continue;
    const f = path.join(ASSETS_DIR, t.logo);
    if (fs.existsSync(f)) logos[t.id] = dataUri(f);
  }
  return `export const FLAGS = ${JSON.stringify(flags)};\nexport const LOGOS = ${JSON.stringify(logos)};\n`;
}

/** @font-face rules for Chakra Petch, latin + latin-ext only, woff2 inlined. */
function fontCss() {
  const dir = path.join(ROOT, 'node_modules', '@fontsource', 'chakra-petch');
  let out = '';
  for (const w of FONT_WEIGHTS) {
    for (const s of FONT_SUBSETS) {
      // The per-weight file holds every subset; take the unicode-range of the block for this subset.
      const css = fs.readFileSync(path.join(dir, `${w}.css`), 'utf8');
      const block = css.split(`/* chakra-petch-${s}-${w}-normal */`)[1];
      const range = block && block.match(/unicode-range:\s*([^;]+);/)?.[1];
      if (!range) throw new Error(`unicode-range not found for ${s} ${w}`);
      const file = path.join(dir, 'files', `chakra-petch-${s}-${w}-normal.woff2`);
      out += `@font-face{font-family:'Chakra Petch';font-style:normal;font-weight:${w};font-display:block;src:url(${dataUri(file)}) format('woff2');unicode-range:${range}}`;
    }
  }
  return out;
}

const virtualAssets = {
  name: 'virtual-assets',
  setup(b) {
    b.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: 'assets', namespace: 'virtual' }));
    b.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({ contents: assetsModule(), loader: 'js', resolveDir: SRC }));
  },
};

export async function buildHtml({ dev = false } = {}) {
  const js = await esbuild.build({
    entryPoints: [path.join(SRC, 'main.js')],
    bundle: true,
    format: 'iife',
    target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    write: false,
    legalComments: 'none',
    define: { __DEV__: String(dev) },
    plugins: [virtualAssets],
    logLevel: 'silent',
  });
  const css = await esbuild.build({
    entryPoints: [path.join(SRC, 'ui', 'styles.css')],
    bundle: true,
    minify: !dev,
    write: false,
    logLevel: 'silent',
  });
  const template = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const style = fontCss() + css.outputFiles[0].text;
  // Function replacers: the bundle contains "$&"-like sequences that a string replacement would expand.
  return template.replace('<!--CSS-->', () => `<style>${style}</style>`).replace('<!--JS-->', () => `<script>${script}</script>`);
}

export async function build() {
  const html = await buildHtml();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, 'index.html');
  fs.writeFileSync(out, html);
  const bytes = Buffer.byteLength(html);
  const pct = ((bytes / BUDGET) * 100).toFixed(0);
  console.log(`dist/index.html  ${(bytes / 1024).toFixed(1)} KB  (${pct}% of 3 MB budget)`);
  if (bytes > BUDGET) { console.error('Over the 3 MB budget!'); process.exitCode = 1; }
  // PWA sidecar files (only used when served over https; index.html works without them).
  const { files, version } = await buildPwaFiles(html);
  let extra = 0;
  for (const [rel, data] of Object.entries(files)) {
    const f = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, data);
    extra += Buffer.byteLength(data);
  }
  console.log(`PWA files        ${(extra / 1024).toFixed(1)} KB  (${Object.keys(files).length} files, cache ${version})`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((e) => { console.error(e.errors || e); process.exit(1); });
}
