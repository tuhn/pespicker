// DOM team card (results screen + 2D fallback). The 3D scene draws its own CanvasTexture version.
import { h, ICONS } from './dom.js';
import { S } from './strings.js';
import { formatStars } from '../draw/format.js';
import { SHOW_CLUB_LOGOS } from '../config.js';
import { FLAGS, LOGOS } from 'virtual:assets';

/** Tier class used for colour (gold / silver / bronze / cool). */
export function tierClass(stars) {
  if (stars == null) return 't0';
  if (stars >= 5) return 't5';
  if (stars >= 4) return 't4';
  if (stars >= 3) return 't3';
  return 't1';
}

export function emblem(team) {
  const flag = FLAGS[team.flagIso];
  if (team.type === 'national') {
    return h('div', { class: 'emblem flag' }, flag ? h('img', { src: flag, alt: '' }) : monogram(team));
  }
  const logo = SHOW_CLUB_LOGOS ? LOGOS[team.id] : null;
  return h('div', { class: logo ? 'emblem' : 'emblem flag' },
    logo ? h('img', { src: logo, alt: '' }) : monogram(team),
    flag ? h('img', { class: 'badge-flag', src: flag, alt: '' }) : null);
}

/** Fallback badge: shortName on the team's colours. */
export function monogram(team) {
  const [c1, c2] = team.colors || [];
  return h('div', { class: 'mono', style: { background: c1 || '#2a4a3c', color: c2 || '#f3fff8' } }, team.shortName || team.name.slice(0, 3).toUpperCase());
}

export function starsEl(stars) {
  if (stars == null) return h('span', { class: 'stars' }, h('span', { class: 'off' }, S.noStars));
  const parts = [];
  for (let i = 1; i <= 5; i++) {
    if (stars >= i) parts.push('★');
    else if (stars >= i - 0.5) parts.push(h('span', { style: { background: 'linear-gradient(90deg, var(--tier) 50%, rgba(168,185,176,0.3) 50%)', '-webkit-background-clip': 'text', 'background-clip': 'text', color: 'transparent' } }, '★'));
    else parts.push(h('span', { class: 'off' }, '★'));
  }
  return h('span', { class: 'stars', role: 'img', 'aria-label': S.starsAria(formatStars(stars)) }, ...parts, h('span', { class: 'stars-num num', 'aria-hidden': 'true' }, formatStars(stars)));
}

/**
 * entry: pool entry { team, stars, ovr, rating }. side: 0 | 1.
 * opts: { name, locked, onLock } - onLock omitted = no lock button.
 */
export function teamCard(entry, side, { name, locked = false, onLock } = {}) {
  const { team, rating } = entry;
  const [c1, c2] = team.colors || ['#888', '#444'];
  const sub = team.type === 'club' ? [team.league, team.country].filter(Boolean).join(' · ') : team.region;
  const stat = (k) => (rating?.[k] != null ? h('span', null, S.stats[k], h('b', { class: 'num' }, rating[k])) : null);
  const hasSub = ['att', 'mid', 'def'].some((k) => rating?.[k] != null);
  return h('article', {
    class: `tcard ${tierClass(entry.stars)} p${side + 1}`,
    style: { '--c1': c1, '--c2': c2 },
    'aria-label': `${name}: ${team.name}`,
  },
    h('div', { class: 'who' },
      h('span', { class: 'pname' }, name),
      onLock ? h('button', {
        class: 'lock-btn', type: 'button', 'aria-pressed': String(locked),
        'aria-label': locked ? S.unlockAria(name, team.name) : S.lockAria(name, team.name),
        onclick: onLock, html: (locked ? ICONS.lock : ICONS.unlock),
      }) : null),
    emblem(team),
    h('div', { class: 'info' },
      h('div', null, h('h2', { class: 'tname' }, team.name), sub ? h('div', { class: 'tsub' }, sub) : null),
      h('div', { class: 'rating' },
        h('div', { class: 'ovr' },
          h('b', { class: 'num' }, entry.ovr ?? '—'),
          rating?.estimated ? h('span', { class: 'est', title: S.estTitle }, S.est) : null,
          h('small', null, S.stats.ovr)),
        starsEl(entry.stars)),
      hasSub ? h('div', { class: 'sub-stats' }, stat('att'), stat('mid'), stat('def')) : null));
}

/** Append the lock label text after the icon (keeps the icon markup trusted). */
export function decorateLockButtons(root) {
  for (const b of root.querySelectorAll('.lock-btn')) b.append(b.getAttribute('aria-pressed') === 'true' ? S.locked : S.lock);
}
