// PWA sidecar files, generated next to dist/index.html.
//
// index.html stays fully self-contained (works alone from file://). These extra files only matter when
// the app is served over https (Cloudflare Pages): they make it installable ("Add to Home Screen" /
// "Install app") and let the installed app start offline.
//   manifest.webmanifest, sw.js, icons/*.png, _headers (Cloudflare Pages cache rules)
import crypto from 'node:crypto';
import sharp from 'sharp';

const BG = '#07130f';
const NEON = '#78ff9a';
const CYAN = '#5cf2ff';

/** App icon: two tilted cards facing off over a hologram projector base. Shapes only (no text). */
function iconSvg({ maskable }) {
  // Maskable icons get a full-bleed background and keep the art inside the 80% safe circle.
  const k = maskable ? 0.8 : 0.92;
  const t = `translate(256 256) scale(${k}) translate(-256 -256)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="g" cx="50%" cy="46%" r="60%">
      <stop offset="0" stop-color="#14402f"/><stop offset="0.6" stop-color="#0a2219"/><stop offset="1" stop-color="${BG}"/>
    </radialGradient>
    <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${CYAN}" stop-opacity="0.55"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ca" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d5a3f"/><stop offset="1" stop-color="#0b241a"/></linearGradient>
    <linearGradient id="cb" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b4d5a"/><stop offset="1" stop-color="#0a1f24"/></linearGradient>
  </defs>
  ${maskable ? `<rect width="512" height="512" fill="url(#g)"/>` : `<rect x="16" y="16" width="480" height="480" rx="108" fill="url(#g)"/>`}
  <g transform="${t}">
    <path d="M150 400 L210 250 L302 250 L362 400 Z" fill="url(#beam)"/>
    <ellipse cx="256" cy="402" rx="128" ry="26" fill="none" stroke="${NEON}" stroke-width="9" stroke-dasharray="26 12"/>
    <ellipse cx="256" cy="402" rx="84" ry="16" fill="none" stroke="${CYAN}" stroke-width="7"/>
    <g transform="rotate(-11 206 230)">
      <rect x="134" y="118" width="146" height="214" rx="20" fill="url(#ca)" stroke="${NEON}" stroke-width="11"/>
      <rect x="160" y="146" width="56" height="14" rx="7" fill="${NEON}"/>
      <circle cx="207" cy="228" r="34" fill="none" stroke="${NEON}" stroke-width="9"/>
      <rect x="160" y="290" width="94" height="10" rx="5" fill="${NEON}" opacity="0.7"/>
    </g>
    <g transform="rotate(11 306 230)">
      <rect x="232" y="118" width="146" height="214" rx="20" fill="url(#cb)" stroke="${CYAN}" stroke-width="11"/>
      <rect x="296" y="146" width="56" height="14" rx="7" fill="${CYAN}"/>
      <circle cx="305" cy="228" r="34" fill="none" stroke="${CYAN}" stroke-width="9"/>
      <rect x="258" y="290" width="94" height="10" rx="5" fill="${CYAN}" opacity="0.7"/>
    </g>
  </g>
</svg>`;
}

async function png(svg, size, { flatten = false } = {}) {
  let img = sharp(Buffer.from(svg), { density: 300 }).resize(size, size);
  if (flatten) img = img.flatten({ background: BG });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

/** Returns { [publishedPath]: Buffer|string } for every PWA file. `html` is the built index.html. */
export async function buildPwaFiles(html) {
  const any = iconSvg({ maskable: false });
  const mask = iconSvg({ maskable: true });
  const files = {
    'icons/icon-192.png': await png(any, 192),
    'icons/icon-512.png': await png(any, 512),
    'icons/maskable-512.png': await png(mask, 512),
    'icons/apple-touch-icon.png': await png(mask, 180, { flatten: true }),
  };
  files['manifest.webmanifest'] = JSON.stringify({
    name: 'Team Draw',
    short_name: 'Team Draw',
    description: 'PES 2021 1v1 random team picker',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BG,
    theme_color: BG,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2);

  // Cache name changes whenever any shipped file changes, so a new deploy replaces the old cache.
  const hash = crypto.createHash('sha256');
  hash.update(html);
  for (const k of Object.keys(files).sort()) hash.update(files[k]);
  hash.update(swSource('', [])); // service worker logic changes also bump the cache
  const version = hash.digest('hex').slice(0, 12);
  // The page is cached under './' only: Cloudflare Pages answers /index.html with a 308 to /, and a
  // redirected response cannot be used to answer a navigation (offline start would fail).
  const precache = ['./', 'manifest.webmanifest', ...Object.keys(files).filter((k) => k.startsWith('icons/'))];
  files['sw.js'] = swSource(version, precache);
  files['_headers'] = [
    '/sw.js',
    '  Cache-Control: no-cache',
    '/',
    '  Cache-Control: no-cache',
    '/index.html',
    '  Cache-Control: no-cache',
    '/manifest.webmanifest',
    '  Content-Type: application/manifest+json',
    '',
  ].join('\n');
  return { files, version };
}

function swSource(version, precache) {
  return `// Generated by scripts/lib/pwa.mjs. Cache version ${version}.
const CACHE = 'pespicker-${version}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pespicker-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// A response that went through a redirect cannot answer a navigation; rebuild it as a plain one.
async function clean(res) {
  if (!res || !res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

// Page: network first (a new deploy shows up as soon as the phone is online), cache when offline.
// Icons / manifest: cache first.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(async (res) => {
      if (res.ok) { const copy = await clean(res.clone()); caches.open(CACHE).then((c) => c.put('./', copy)); }
      return res;
    }).catch(() => caches.match('./').then(clean)));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`;
}
