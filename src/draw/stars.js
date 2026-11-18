// Pure helpers: OVR -> stars, quantile thresholds, merging ratings with overrides.

export const STAR_LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** thresholds: 8 ascending OVR minimums for 1.5★..5★. Returns null when ovr is null. */
export function ovrToStars(ovr, thresholds) {
  if (ovr == null || !Number.isFinite(ovr)) return null;
  let stars = 1;
  for (let i = 0; i < thresholds.length; i++) if (ovr >= thresholds[i]) stars = STAR_LEVELS[i + 1];
  return stars;
}

/**
 * Equal-frequency thresholds for 9 levels. OVRs are integers with many ties, so plain
 * interpolated quantiles can produce duplicate cut points (= empty levels). Instead, cut i
 * is the OVR value (taken from the data, strictly greater than cut i-1) whose
 * "teams below it" count is closest to n*i/9. Every level therefore keeps >= 1 team
 * as long as there are >= 9 distinct OVR values.
 */
export function quantileThresholds(ovrs) {
  const v = ovrs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const distinct = [...new Set(v)];
  const below = (t) => v.filter((x) => x < t).length;
  const out = [];
  let prevIdx = 0; // index into distinct; cut must be > distinct[prevIdx - 1]
  for (let i = 1; i <= 8; i++) {
    const target = (v.length * i) / 9;
    const remaining = 8 - i; // cuts still needed after this one
    let best = null;
    for (let k = Math.max(prevIdx, 1); k <= distinct.length - 1 - remaining; k++) {
      const d = Math.abs(below(distinct[k]) - target);
      if (best == null || d < best.d) best = { k, d };
    }
    if (!best) break;
    out.push(distinct[best.k]);
    prevIdx = best.k + 1;
  }
  return out;
}

/**
 * Merge collected ratings with manual overrides. Overrides always win, field by field.
 * An override may set `stars` directly without an OVR.
 * Returns { [id]: { ovr, att, mid, def, stars, source, sourceUrl, estimated } }.
 */
export function resolveRatings(teams, ratings, overrides, thresholds) {
  const out = {};
  for (const t of teams) {
    const r = ratings[t.id] || null;
    const o = overrides[t.id] || null;
    const base = r
      ? { ovr: r.ovr, att: r.att, mid: r.mid, def: r.def, source: r.source, sourceUrl: r.sourceUrl }
      : { ovr: null, att: null, mid: null, def: null, source: null, sourceUrl: null };
    let merged = base;
    if (o) {
      merged = { ...base };
      for (const k of ['ovr', 'att', 'mid', 'def']) if (k in o) merged[k] = o[k];
      merged.source = 'override';
      merged.sourceUrl = o.note || null;
    }
    const stars = o && o.stars != null ? o.stars : ovrToStars(merged.ovr, thresholds);
    out[t.id] = { ...merged, stars, estimated: merged.source === 'elo-mapped' };
  }
  return out;
}
