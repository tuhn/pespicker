// Core 1v1 draw. Pure: no DOM, no Three.js, randomness injected.
//
// drawMatch({ pool, balance, allowMirror, current, locked, rng }) ->
//   { ok: true, teams: [idP1, idP2], notice }        notice: null | { code: 'gap-widened', from, to }
//   { ok: false, error: { code, ...details } }
//
// Rules (CLAUDE.md "Chế độ cân bằng" / "Tính năng"):
// - Unrated teams (stars null) are only eligible in "free".
// - A locked side keeps its team; balance is computed against that team.
// - Both sides locked -> error (Redraw is disabled in the UI).
// - Mirror off -> the two teams are always different; never relaxed silently.
// - "gap" widens by 0.5★ steps when nothing fits and reports it via `notice`; every other
//   unmet condition is an error, never a silent fallback.
import { pick, weightedPick } from './rng.js';

export const BALANCE_MODES = ['free', 'same-tier', 'gap'];
export const GAP_OPTIONS = [0.5, 1, 1.5];
const GAP_STEP = 0.5;
const MAX_GAP = 4; // the whole 1★..5★ range

export function drawMatch({ pool, balance = { mode: 'gap', gap: 1 }, allowMirror = false, current = [null, null], locked = [false, false], rng }) {
  if (!rng) throw new Error('drawMatch: rng required');
  if (!BALANCE_MODES.includes(balance.mode)) throw new Error(`Unknown balance mode: ${balance.mode}`);
  if (balance.mode === 'gap' && !(balance.gap > 0)) throw new Error('gap balance needs gap > 0');
  if (locked[0] && locked[1]) return fail('both-locked');

  const eligible = balance.mode === 'free' ? pool : pool.filter((e) => e.stars != null);
  const lockedSide = locked[0] ? 0 : locked[1] ? 1 : -1;

  if (lockedSide >= 0) {
    const anchorId = current[lockedSide];
    const anchor = pool.find((e) => e.id === anchorId);
    if (!anchor) return fail('locked-not-in-pool', { teamId: anchorId ?? null });
    if (balance.mode !== 'free' && anchor.stars == null) return fail('locked-unrated', { teamId: anchor.id });
    const p = partners(anchor, eligible, balance, allowMirror);
    if (!p.ok) return p;
    const other = pick(p.candidates, rng);
    const teams = [null, null];
    teams[lockedSide] = anchor.id;
    teams[1 - lockedSide] = other.id;
    return done(teams, p.notice);
  }

  const minSize = allowMirror ? 1 : 2;
  if (eligible.length < minSize) return fail('pool-too-small', { available: eligible.length, needed: minSize });

  let first;
  if (balance.mode === 'same-tier') {
    // Weighted by team count so every eligible team has the same chance of being drawn first.
    const counts = new Map();
    for (const e of eligible) counts.set(e.stars, (counts.get(e.stars) || 0) + 1);
    const tiers = [...counts].filter(([, n]) => n >= 2);
    if (!tiers.length) return fail('no-tier');
    const tier = weightedPick(tiers, rng);
    first = pick(eligible.filter((e) => e.stars === tier), rng);
  } else {
    first = pick(eligible, rng);
  }
  const p = partners(first, eligible, balance, allowMirror);
  if (!p.ok) return p;
  const second = pick(p.candidates, rng);
  // Random side assignment so neither player is systematically the "anchor".
  const teams = rng.randomInt(2) === 0 ? [first.id, second.id] : [second.id, first.id];
  return done(teams, p.notice);
}

/** Candidates that may face `anchor` under the balance rule. */
function partners(anchor, eligible, balance, allowMirror) {
  const base = eligible.filter((e) => allowMirror || e.id !== anchor.id);
  if (balance.mode === 'free') {
    return base.length ? { ok: true, candidates: base, notice: null } : fail('pool-too-small', { available: eligible.length, needed: allowMirror ? 1 : 2 });
  }
  if (balance.mode === 'same-tier') {
    const c = base.filter((e) => e.stars === anchor.stars);
    return c.length ? { ok: true, candidates: c, notice: null } : fail('no-tier', { stars: anchor.stars, teamId: anchor.id });
  }
  for (let g = balance.gap; g <= MAX_GAP + 1e-9; g += GAP_STEP) {
    const c = base.filter((e) => Math.abs(e.stars - anchor.stars) <= g + 1e-9);
    if (c.length) return { ok: true, candidates: c, notice: g > balance.gap ? { code: 'gap-widened', from: balance.gap, to: g } : null };
  }
  return fail('no-match-in-gap', { teamId: anchor.id, gap: balance.gap });
}

/** OVR difference between the two drawn teams, or null when either OVR is unknown. */
export function ovrGap(a, b) {
  if (a?.ovr == null || b?.ovr == null) return null;
  return Math.abs(a.ovr - b.ovr);
}

/** Whether Redraw can run at all for the given lock state. */
export const canRedraw = (locked) => !(locked[0] && locked[1]);

const fail = (code, details = {}) => ({ ok: false, error: { code, ...details } });
const done = (teams, notice) => ({ ok: true, teams, notice: notice || null });
