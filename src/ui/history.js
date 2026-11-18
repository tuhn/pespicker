// History bottom sheet (<dialog>): last 20 draws, newest first.
import { h, ICONS } from './dom.js';
import { S } from './strings.js';

/** ctx: { history, teamName(id), onClear } */
export function openHistory(ctx) {
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'hist-t' });
  const close = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return today ? time : `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${time}`;
  };
  const body = ctx.history.length
    ? h('ol', { class: 'hist' }, ctx.history.map((e) => h('li', null,
      h('div', { class: 'h-meta' }, h('span', { class: 'num' }, fmtTime(e.at)), h('span', null, S.modes[e.mode] || e.mode), h('span', null, S.balanceLabel(e.balance || { mode: 'free' }))),
      h('div', { class: 'h-match' }, ctx.teamName(e.teams[0]), h('em', null, ' vs '), ctx.teamName(e.teams[1])),
      h('div', { class: 'h-meta' }, `${e.players?.[0] || S.defaultNames[0]} · ${e.players?.[1] || S.defaultNames[1]}`))))
    : h('p', { class: 'empty' }, S.historyEmpty);

  const clearBtn = ctx.history.length ? h('button', {
    type: 'button', class: 'btn', style: { width: '100%' },
    onclick: () => { if (window.confirm(S.historyClearConfirm)) { ctx.onClear(); close(); } },
    html: ICONS.trash,
  }) : null;
  clearBtn?.append(S.historyClear);

  dlg.append(
    h('div', { class: 'sheet-head' }, h('h2', { id: 'hist-t' }, S.history),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': S.close, onclick: close, html: ICONS.close })),
    body,
    clearBtn ? h('div', { class: 'sheet-foot' }, clearBtn) : null);
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}
