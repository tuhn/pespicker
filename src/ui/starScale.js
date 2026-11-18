// "Star scale" sheet: what each star level means in OVR, and how many teams of the current pool sit there.
import { h, ICONS } from './dom.js';
import { S } from './strings.js';
import { STAR_LEVELS } from '../draw/stars.js';
import { starsEl } from './card.js';

/** ctx: { thresholds, pool, mode } */
export function openStarScale({ thresholds, pool, mode }) {
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'scale-t' });
  const close = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  const range = (i) => {
    // level index i in STAR_LEVELS (0 = 1★): OVR from thresholds[i-1] to thresholds[i]-1
    const lo = i === 0 ? null : thresholds[i - 1];
    const hi = i === STAR_LEVELS.length - 1 ? null : thresholds[i] - 1;
    if (lo == null) return S.scaleBelow(hi);
    if (hi == null) return S.scaleAbove(lo);
    return lo === hi ? String(lo) : `${lo}–${hi}`;
  };
  const rows = [...STAR_LEVELS].map((s, i) => [s, i]).reverse().map(([s, i]) => {
    const n = pool.filter((e) => e.stars === s).length;
    return h('tr', null,
      h('td', null, starsEl(s)),
      h('td', { class: 'num' }, range(i)),
      h('td', { class: 'num' }, n));
  });
  const unrated = pool.filter((e) => e.stars == null).length;

  dlg.append(
    h('div', { class: 'sheet-head' }, h('h2', { id: 'scale-t' }, S.scaleTitle),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': S.close, onclick: close, html: ICONS.close })),
    h('div', { class: 'scale-body' },
      h('p', { class: 'help' }, S.scaleIntro),
      h('table', { class: 'scale' },
        h('thead', null, h('tr', null, h('th', null, S.scaleStars), h('th', null, S.scaleOvr), h('th', null, S.scaleTeams(S.modes[mode])))),
        h('tbody', null, rows)),
      unrated ? h('p', { class: 'help' }, S.scaleUnrated(unrated)) : null,
      h('p', { class: 'help' }, S.scaleEst)));
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

/** One-line summary for the Balance panel, e.g. "★ = OVR band · ½★ per 2 OVR · 5★ = 84+". */
export function scaleSummary(thresholds) {
  const step = thresholds[1] - thresholds[0];
  const even = thresholds.every((t, i) => i === 0 || t - thresholds[i - 1] === step);
  return even ? S.scaleSummary(step, thresholds[thresholds.length - 1]) : S.scaleSummaryCustom(thresholds[thresholds.length - 1]);
}

