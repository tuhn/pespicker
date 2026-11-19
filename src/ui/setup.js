// Setup screen: pool mode, player names, balance (+ mirror switch), sticky "Draw teams" + install link.
import { h, ICONS } from './dom.js';
import { S } from './strings.js';
import { POOL_MODES } from '../draw/pool.js';
import { GAP_OPTIONS } from '../draw/draw.js';

/**
 * ctx: { state, poolStats: { [mode]: { total, rated } }, scaleSummary, showInstall,
 *        actions: { setMode, setName, setBalance, setMirror, draw, openHistory, openStarScale, install } }
 */
export function renderSetup(ctx) {
  const { state, poolStats, actions } = ctx;
  const stats = poolStats[state.mode];

  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': S.pool },
    POOL_MODES.map((m) => h('button', {
      type: 'button', role: 'tab', id: `tab-${m}`, 'aria-selected': String(state.mode === m),
      tabindex: state.mode === m ? '0' : '-1',
      onclick: () => actions.setMode(m),
      onkeydown: (e) => arrowNav(e, POOL_MODES, m, actions.setMode),
    }, S.modes[m], h('small', { class: 'num' }, S.teamsCount(poolStats[m].total)))));

  const names = h('div', { class: 'names' }, [0, 1].map((i) => h('label', { class: 'field' },
    h('span', { class: `side p${i + 1}` }, `P${i + 1}`),
    h('input', {
      type: 'text', value: state.players[i], placeholder: S.defaultNames[i], maxlength: '24',
      autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'done', spellcheck: false,
      'aria-label': S.playerLabel(i),
      oninput: (e) => actions.setName(i, e.target.value),
    }))));

  const bModes = ['free', 'same-tier', 'gap'];
  const balance = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': S.balance },
    bModes.map((m) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(state.balance.mode === m),
      tabindex: state.balance.mode === m ? '0' : '-1',
      onclick: () => actions.setBalance(m === 'gap' ? { mode: 'gap', gap: state.balance.gap ?? 1 } : { mode: m }),
      onkeydown: (e) => arrowNav(e, bModes, state.balance.mode, (v) => actions.setBalance(v === 'gap' ? { mode: 'gap', gap: 1 } : { mode: v })),
    }, S.balanceModes[m])));
  const gapChips = state.balance.mode === 'gap'
    ? h('div', { class: 'chips', role: 'radiogroup', 'aria-label': S.balanceModes.gap },
      GAP_OPTIONS.map((g) => h('button', {
        type: 'button', role: 'radio', class: 'num', 'aria-checked': String(state.balance.gap === g),
        onclick: () => actions.setBalance({ mode: 'gap', gap: g }),
      }, S.gapOption(g))))
    : null;
  const help = state.balance.mode === 'gap' ? S.balanceHelp.gap(state.balance.gap) : S.balanceHelp[state.balance.mode];
  // Star scale only matters when stars are used to balance.
  const helpLine = h('p', { class: 'help' }, help, state.balance.mode === 'free' ? null : h('span', { class: 'scale-line num' }, ` ${ctx.scaleSummary}`));

  const sw = (label, sub, on, fn) => h('button', { type: 'button', class: 'switch-row', role: 'switch', 'aria-checked': String(on), onclick: () => fn(!on) },
    h('span', null, h('b', null, label), h('small', null, sub)), h('span', { class: 'track', 'aria-hidden': 'true' }));

  const historyBtn = h('button', { type: 'button', class: 'icon-btn history-btn', onclick: actions.openHistory, 'aria-label': `${S.history} (${state.history.length})`, html: ICONS.history });
  if (state.history.length) historyBtn.append(h('span', { class: 'badge num', 'aria-hidden': 'true' }, state.history.length));

  // Small footer action under "Draw teams", shown until the app runs installed (standalone).
  const installBtn = ctx.showInstall ? h('button', { type: 'button', class: 'install-link', onclick: actions.install, html: ICONS.download }) : null;
  installBtn?.append(S.install);

  return h('main', { class: 'screen setup' },
    h('header', { class: 'brand' },
      h('div', null, h('h1', null, S.appTitle), h('p', null, S.appTagline)),
      historyBtn),
    h('section', { class: 'panel', 'aria-labelledby': 'pool-t' },
      h('h2', { class: 'panel-title', id: 'pool-t' }, S.pool, h('span', { class: 'num' }, S.ratedCount(stats.rated, stats.total))),
      tabs),
    h('section', { class: 'panel', 'aria-labelledby': 'players-t' }, h('h2', { class: 'panel-title', id: 'players-t' }, S.players), names),
    h('section', { class: 'panel', 'aria-labelledby': 'balance-t' },
      h('div', { class: 'panel-title' },
        h('h2', { id: 'balance-t', class: 'panel-title-text' }, S.balance),
        h('button', { type: 'button', class: 'link-btn', onclick: actions.openStarScale, 'aria-haspopup': 'dialog' }, S.scaleButton)),
      balance, gapChips, helpLine,
      h('div', { class: 'panel-sep' }),
      sw(S.allowMirror, S.allowMirrorHelp, state.allowMirror, actions.setMirror)),
    h('div', { class: 'dock' }, h('div', { class: 'dock-inner' },
      h('button', { type: 'button', class: 'btn-primary', id: 'draw-btn', onclick: actions.draw }, S.drawTeams),
      installBtn)));
}

/** Arrow-key navigation for tablists / radiogroups. */
function arrowNav(e, values, current, set) {
  const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const next = values[(values.indexOf(current) + d + values.length) % values.length];
  set(next);
  requestAnimationFrame(() => document.querySelector('[aria-selected="true"]:focus, [aria-checked="true"]')?.focus());
}
