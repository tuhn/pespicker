// App bootstrap + router between Setup and Match screens.
//
// Rendering paths for the Match screen:
// - 3D: WebGL scene (src/scene) behind a DOM layer that holds text, locks and controls.
// - 2D: CSS fallback (ui/fallback2d.js) when WebGL is missing or lost, prefers-reduced-motion is
//   set, or "Reduce effects" is on. Draw logic is identical in both.
// Three.js is initialised only after the 2D setup screen has painted.
import teams from './data/teams.json';
import ratingsFile from './data/ratings.json';
import overrides from './data/overrides.json';
import { STAR_THRESHOLDS } from './config.js';
import { resolveRatings } from './draw/stars.js';
import { buildPool, POOL_MODES } from './draw/pool.js';
import { drawMatch } from './draw/draw.js';
import { createCryptoRng, createSeededRng } from './draw/rng.js';
import { formatMatch, playerName } from './draw/format.js';
import * as St from './state.js';
import { h, clear } from './ui/dom.js';
import { S } from './ui/strings.js';
import { renderSetup } from './ui/setup.js';
import { renderMatch, renderMatch3D } from './ui/results.js';
import { openHistory } from './ui/history.js';
import { openStarScale, scaleSummary } from './ui/starScale.js';
import { play2D, prefersReducedMotion } from './ui/fallback2d.js';
import { createScene, hasWebGL } from './scene/index.js';

const params = new URLSearchParams(location.search);
// ?seed=N makes draws reproducible (screenshots / debugging). Normal use: crypto RNG.
const rng = params.has('seed') ? createSeededRng(Number(params.get('seed')) || 1) : createCryptoRng();
const DEBUG = params.get('debug') === '1';

const resolved = resolveRatings(teams, ratingsFile.teams || {}, overrides, STAR_THRESHOLDS);
const byId = new Map(teams.map((t) => [t.id, t]));
const pools = Object.fromEntries(POOL_MODES.map((m) => [m, buildPool(teams, resolved, m)]));
const poolStats = Object.fromEntries(POOL_MODES.map((m) => [m, { total: pools[m].length, rated: pools[m].filter((e) => e.stars != null).length }]));
const entryOf = (id) => pools.mixed.find((e) => e.id === id);

const persistence = St.createPersistence();
let state = persistence.load();
let screen = 'setup';
let sequence = null; // running draw animation controller (2D or 3D)
let scene = null; // WebGL scene, created lazily
let sceneFailed = false;
let zoomed = -1;

const root = document.getElementById('app');
const names = () => [0, 1].map((i) => playerName(state.players, i, S.defaultNames));
const use3D = () => !!scene && !sceneFailed && !scene.lost && !state.reduceEffects && !prefersReducedMotion() && !params.has('no3d');

function update(next, { render = true } = {}) {
  state = next;
  persistence.save(state);
  if (render) draw();
}

// ---------- actions ----------
const actions = {
  setMode: (m) => update(St.setMode(state, m)),
  setName: (i, v) => update(St.setPlayerName(state, i, v), { render: false }),
  setBalance: (b) => update(St.setBalance(state, b)),
  setMirror: (on) => update(St.setAllowMirror(state, on)),
  setReduce: (on) => update(St.setReduceEffects(state, on)),
  draw: () => runDraw(),
  redraw: () => runDraw(),
  back: () => { screen = 'setup'; draw(); },
  swap: () => update(St.swapSides(state)),
  lock: (side) => update(St.toggleLock(state, side)),
  copy: () => copyResult(),
  share: () => shareResult(),
  openStarScale: () => openStarScale({ thresholds: STAR_THRESHOLDS, pool: pools[state.mode], mode: state.mode }),
  openHistory: () => openHistory({ history: state.history, teamName: (id) => byId.get(id)?.name || id, onClear: () => update(St.clearHistory(state)) }),
  skip: () => sequence?.skip(),
  speedUp: () => sequence?.speedUp(),
  tilt: (i, nx, ny) => scene?.tilt(i, nx, ny),
  release: (i) => scene?.release(i),
  zoom: (i) => setZoom(i),
};

function runDraw() {
  if (sequence) return;
  const fromSetup = screen === 'setup';
  const result = state.result;
  const locked = result ? result.locked : [false, false];
  const res = drawMatch({
    pool: pools[state.mode],
    balance: state.balance,
    allowMirror: state.allowMirror,
    current: result ? result.teams : [null, null],
    locked,
    rng,
  });
  if (!res.ok) {
    const msg = S.errors[res.error.code];
    toast(typeof msg === 'function' ? msg(res.error) : msg || S.errors.unknown, 'error');
    return;
  }
  update(St.applyDraw(state, res), { render: false });
  screen = 'match';
  draw({ animateSides: [!locked[0], !locked[1]], boot: fromSetup });
}

function currentText() {
  return formatMatch(names(), state.result.teams.map(entryOf));
}

async function copyResult() {
  const text = currentText();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else legacyCopy(text);
    toast(S.copied, 'info');
  } catch {
    try { legacyCopy(text); toast(S.copied, 'info'); } catch { toast(S.copyFailed, 'error'); }
  }
}
function legacyCopy(text) {
  const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}
async function shareResult() {
  try { await navigator.share({ title: S.appTitle, text: currentText() }); } catch { /* user cancelled */ }
}

// ---------- zoom (3D card inspect) ----------
function setZoom(i) {
  if (!scene || sequence) return;
  const on = scene.toggleZoom(i);
  zoomed = on ? i : -1;
  const screenEl = root.querySelector('.match3d');
  screenEl?.classList.toggle('zoomed', on);
  document.querySelector('.zoom-catcher')?.remove();
  if (!on) return;
  // Full-screen layer: drag tilts the zoomed card, tap closes.
  const catcher = h('button', { type: 'button', class: 'zoom-catcher', 'aria-label': S.unzoom });
  let start = null;
  catcher.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, moved: false }; catcher.setPointerCapture?.(e.pointerId); });
  catcher.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 8) start.moved = true;
    if (start.moved) scene.tilt(zoomed, dx / 140, dy / 140);
  });
  catcher.addEventListener('pointerup', () => { const tap = start && !start.moved; start = null; scene.release(zoomed); if (tap) closeZoom(); });
  catcher.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeZoom(); });
  catcher.addEventListener('click', (e) => { if (e.detail === 0) closeZoom(); }); // keyboard activation
  document.body.append(catcher);
  catcher.focus();
}
function closeZoom() {
  scene?.unzoom();
  zoomed = -1;
  root.querySelector('.match3d')?.classList.remove('zoomed');
  document.querySelector('.zoom-catcher')?.remove();
}

// ---------- rendering ----------
let toastTimer;
function toast(msg, kind = 'info') {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3600);
}

function draw({ animateSides = null, boot = false } = {}) {
  closeZoom();
  clear(root);
  if (screen === 'setup' || !state.result) {
    screen = 'setup';
    document.body.classList.remove('mode3d');
    scene?.hide();
    root.append(renderSetup({ state, poolStats, actions, scaleSummary: scaleSummary(STAR_THRESHOLDS), canInstall: !!installPrompt }));
    return;
  }
  const animating = !!animateSides;
  const entries = state.result.teams.map(entryOf);
  const ctx = { state, entries, names: names(), animating, animateSides, canShare: typeof navigator.share === 'function', actions };
  window.scrollTo(0, 0);

  if (use3D()) {
    document.body.classList.add('mode3d');
    const view = renderMatch3D(ctx);
    root.append(view.el);
    scene.setLayoutSource(() => ({
      cards: view.anchors.cards.map((a) => a.getBoundingClientRect()),
      vs: view.anchors.vs.getBoundingClientRect(),
    }));
    if (!animating) { scene.showResult({ entries, names: ctx.names }); return; }
    // Placeholder so taps during prepare() are queued, not lost.
    let ctl = null, wantSkip = false, wantFast = false;
    sequence = { skip: () => (ctl ? ctl.skip() : (wantSkip = true)), speedUp: () => (ctl ? ctl.speedUp() : (wantFast = true)) };
    const reveal = (el) => el?.classList.remove('pending');
    scene.play({
      entries, names: ctx.names, animateSides, boot,
      onBars: () => {
        for (const el of view.reveal.sides) reveal(el);
        reveal(view.reveal.cmp);
        for (const b of view.reveal.bars) b.animate?.([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
        for (const el of view.reveal.rest) reveal(el);
      },
    }).then((c) => {
      ctl = c;
      if (wantFast) c.speedUp();
      if (wantSkip) c.skip();
      return c.finished;
    }).catch((e) => {
      console.error(e);
      sceneFailed = true;
    }).finally(() => { sequence = null; draw(); });
    return;
  }

  document.body.classList.remove('mode3d');
  scene?.hide();
  const view = renderMatch(ctx);
  root.append(view.el);
  if (animating) {
    const reduced = state.reduceEffects || prefersReducedMotion();
    sequence = play2D(view.anim, { animate: animateSides, fiveStar: entries.map((e) => e.stars === 5), reduced });
    sequence.finished.then(() => { sequence = null; draw(); });
  }
}

function initScene() {
  if (scene || sceneFailed || params.has('no3d') || !hasWebGL()) return;
  try {
    scene = createScene({ debug: DEBUG, onContextLost: () => { /* running sequence is skipped; next draw uses 2D until restored */ } });
    if (DEBUG) window.__scene = scene;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    idle(() => scene.warmup().catch((e) => { console.error(e); sceneFailed = true; }), { timeout: 1500 });
  } catch (e) {
    console.error('3D init failed, using 2D fallback', e);
    sceneFailed = true;
  }
}

// ---------- PWA ----------
// Service worker only for the deployed https build (not dev: it would fight live reload,
// not file://: unsupported). index.html works fully without it.
if (!__DEV__ && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
}
// Android/Chrome: offer an "Install app" button when the browser says the app is installable.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (screen === 'setup') draw();
});
window.addEventListener('appinstalled', () => { installPrompt = null; if (screen === 'setup') draw(); });
actions.install = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch { /* dismissed */ }
  installPrompt = null;
  if (screen === 'setup') draw();
};

draw();
// Initialise Three.js only after the 2D UI has painted.
requestAnimationFrame(() => setTimeout(initScene, 30));
