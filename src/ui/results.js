// Match screen: two cards facing each other across VS, comparison bars, gap, and the result
// controls (lock per side, redraw, history). The draw animation plays on
// this same layout, so "Skip" simply jumps to its final state.
//
// Two variants share the compare/dock builders:
// - renderMatch   (2D): DOM cards, animated by ui/fallback2d.js
// - renderMatch3D (3D): empty card/VS anchors that the WebGL scene fills; DOM keeps crisp text
//   (player, team, rating) and the lock buttons next to each 3D card.
import { h, ICONS } from './dom.js';
import { S } from './strings.js';
import { teamCard, decorateLockButtons } from './card.js';
import { ovrGap, canRedraw } from '../draw/draw.js';

const STATS = ['att', 'mid', 'def', 'ovr'];

function buildCompare(entries, names, notice, pending) {
  // Only stats both teams have (Elo-mapped teams have OVR only).
  const shown = STATS.filter((k) => entries[0].rating?.[k] != null && entries[1].rating?.[k] != null);
  const bars = [];
  const rows = shown.map((k) => {
    const a = entries[0].rating[k];
    const b = entries[1].rating[k];
    const w = (v) => `${Math.max(8, Math.min(100, ((v - 50) / 45) * 100)).toFixed(0)}%`;
    const ia = h('i', { class: a > b ? 'win' : '', style: { '--w': w(a) } });
    const ib = h('i', { class: b > a ? 'win' : '', style: { '--w': w(b) } });
    bars.push(ia, ib);
    return h('div', { class: 'cmp', role: 'row', 'aria-label': `${S.stats[k]}: ${a} vs ${b}` },
      h('span', { class: `v num ${a > b ? 'win' : ''}` }, a),
      h('div', { class: 'bar l' }, ia),
      h('span', { class: 'lbl' }, S.stats[k]),
      h('div', { class: 'bar' }, ib),
      h('span', { class: `v num ${b > a ? 'win' : ''}` }, b));
  });
  const gap = ovrGap(entries[0], entries[1]);
  const gapLine = h('div', { class: `gapline ${pending}`, 'aria-label': gap == null ? S.gapUnknown : S.gap(gap) },
    gap == null ? S.gapUnknown : [`${S.gapPrefix} `, h('span', { class: 'num' }, gap), ` ${S.gapUnit}`]);
  const noticeEl = notice && S.notices[notice.code] ? h('div', { class: `notice ${pending}`, role: 'status' }, S.notices[notice.code](notice)) : null;
  const table = h('div', { class: 'cmp-table', role: 'table', 'aria-label': 'Comparison' }, rows);
  return { table, bars, gapLine, noticeEl, names: h('div', { class: 'cmp-names' }, h('span', null, names[0]), h('span', null, names[1])) };
}

function buildDock(ctx, locked) {
  const { animating, actions } = ctx;
  if (animating) {
    return h('div', { class: 'dock' }, h('div', { class: 'dock-inner' },
      h('button', { type: 'button', class: 'btn', id: 'skip-btn', onclick: (e) => { e.stopPropagation(); actions.skip(); } }, S.skip)));
  }
  // One clear action at the bottom; History lives in the top bar.
  const redrawDisabled = !canRedraw(locked);
  return h('div', { class: 'dock' }, h('div', { class: 'dock-inner' },
    h('button', { type: 'button', class: 'btn-primary', id: 'redraw-btn', onclick: actions.redraw, disabled: redrawDisabled, 'aria-describedby': redrawDisabled ? 'redraw-why' : null },
      redrawDisabled ? S.redrawLockedBoth : S.redraw),
    redrawDisabled ? h('span', { id: 'redraw-why', class: 'sr-only' }, S.errors['both-locked']) : null));
}

function topBar(state, actions) {
  const back = h('button', { type: 'button', class: 'btn-ghost', onclick: actions.back, 'aria-label': S.backAria, html: ICONS.back });
  back.append(S.back);
  const history = h('button', { type: 'button', class: 'icon-btn history-btn', onclick: actions.openHistory, 'aria-label': S.history, html: ICONS.history });
  return h('div', { class: 'match-top' }, back, h('div', { class: 'meta' }, `${S.modes[state.mode]} · ${S.balanceLabel(state.balance)}`), history);
}

const speedHandler = (ctx) => (ctx.animating ? (e) => { if (!e.target.closest('button')) ctx.actions.speedUp(); } : null);

/**
 * 2D variant. ctx: { state, entries, names, animating, animateSides, actions }
 * Returns { el, anim } where anim holds the nodes the 2D sequence animates.
 */
export function renderMatch(ctx) {
  const { state, entries, names, animating, actions } = ctx;
  const { locked, notice } = state.result;
  const pending = animating ? 'pending' : '';

  const slots = [];
  const flips = [];
  for (const i of [0, 1]) {
    const card = teamCard(entries[i], i, { name: names[i], locked: locked[i], onLock: animating ? null : () => actions.lock(i) });
    const flip = h('div', { class: 'flip' }, card, h('div', { class: 'card-back', 'aria-hidden': 'true' }));
    flips.push(flip);
    slots.push(h('div', { class: `card-slot ${animating && ctx.animateSides[i] ? 'pending' : ''}` }, flip));
  }
  const cmp = buildCompare(entries, names, notice, pending);
  const vs = h('div', { class: 'vs', 'aria-hidden': 'true' }, S.vs);
  const clash = h('section', { class: `clash ${pending}`, 'aria-label': S.vs }, vs, cmp.names, cmp.table, cmp.gapLine, cmp.noticeEl);

  const el = h('main', { class: 'screen match', onpointerdown: speedHandler(ctx) },
    topBar(state, actions),
    h('div', { class: 'stage' }, slots[0], clash, slots[1]),
    h('div', { class: 'hint', 'aria-hidden': 'true' }, animating ? S.tapToSpeed : ''),
    buildDock(ctx, locked));
  decorateLockButtons(el);
  return { el, anim: { flips, slots, vs, clash, bars: cmp.bars, reveal: [cmp.gapLine, cmp.noticeEl].filter(Boolean) } };
}

/**
 * 3D variant: the two 3D cards stand side by side across the VS badge (P1 left, P2 right), so the
 * left/right columns of the comparison below map straight onto the cards. The DOM only adds what
 * the cards cannot: a lock button under each card, the comparison, the gap line and the controls.
 * Returns { el, anchors: { cards: [el, el], vs: el }, reveal: { sides: [el, el], cmp, bars, rest } }.
 */
export function renderMatch3D(ctx) {
  const { state, entries, names, animating, actions } = ctx;
  const { locked, notice } = state.result;
  const pending = animating ? 'pending' : '';
  const anchors = [];
  const locks = [];
  const sides = [0, 1].map((i) => {
    const e = entries[i];
    const est = e.rating?.estimated ? ` ${S.est}` : '';
    const anchor = h('button', {
      type: 'button', class: 'card-anchor',
      'aria-label': `${names[i]}: ${e.team.name}, ${S.stats.ovr} ${e.ovr ?? '—'}${est}, ${e.stars != null ? S.starsAria(e.stars) : S.noStars}. ${S.inspect}`,
    });
    attachTilt(anchor, i, actions, animating);
    anchors.push(anchor);
    const lockBtn = h('button', {
      class: `lock-btn lock3d ${pending}`, type: 'button', 'aria-pressed': String(locked[i]),
      'aria-label': locked[i] ? S.unlockAria(names[i], e.team.name) : S.lockAria(names[i], e.team.name),
      disabled: animating, onclick: () => actions.lock(i), html: locked[i] ? ICONS.lock : ICONS.unlock,
    });
    locks.push(lockBtn);
    return anchor;
  });
  const cmp = buildCompare(entries, names, notice, pending);
  const vsAnchor = h('div', { class: 'vs-anchor', 'aria-hidden': 'true' });
  const panel = h('section', { class: `cmp-panel ${pending}`, 'aria-label': S.vs }, cmp.table, cmp.gapLine, cmp.noticeEl);

  const el = h('main', { class: 'screen match match3d', onpointerdown: speedHandler(ctx) },
    topBar(state, actions),
    h('div', { class: 'stage3d' },
      h('div', { class: 'duel' }, sides[0], sides[1]),
      // VS rests between the two lock buttons so it never covers the cards.
      h('div', { class: 'locks-row' }, locks[0], vsAnchor, locks[1]),
      panel),
    animating ? h('div', { class: 'hint', 'aria-hidden': 'true' }, S.tapToSpeed) : null,
    buildDock(ctx, locked));
  decorateLockButtons(el);
  return {
    el,
    anchors: { cards: anchors, vs: vsAnchor },
    reveal: { sides: locks, cmp: panel, bars: cmp.bars, rest: [cmp.gapLine, cmp.noticeEl].filter(Boolean) },
  };
}

/** One-finger drag tilts the 3D card; a tap (little movement) zooms it. */
function attachTilt(anchor, i, actions, animating) {
  let start = null;
  anchor.addEventListener('pointerdown', (e) => {
    if (animating) return;
    start = { x: e.clientX, y: e.clientY, moved: false };
    anchor.setPointerCapture?.(e.pointerId);
  });
  anchor.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 8) start.moved = true;
    if (start.moved) actions.tilt(i, dx / 120, dy / 120);
  });
  const end = () => {
    if (!start) return;
    const tap = !start.moved;
    start = null;
    actions.release(i);
    if (tap) actions.zoom(i);
  };
  anchor.addEventListener('pointerup', end);
  anchor.addEventListener('pointercancel', () => { start = null; actions.release(i); });
  anchor.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions.zoom(i); } });
  anchor.addEventListener('click', (e) => e.preventDefault());
}
