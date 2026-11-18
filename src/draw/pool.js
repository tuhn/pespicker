// Build the candidate list for a pool mode. Pure: takes teams + resolved ratings (see stars.js).

export const POOL_MODES = ['national', 'club', 'mixed'];

/**
 * Returns entries { id, team, stars, ovr, rating } for the mode, in teams.json order.
 * `resolved` is the output of resolveRatings(); a team missing from it is treated as unrated.
 */
export function buildPool(teams, resolved, mode) {
  if (!POOL_MODES.includes(mode)) throw new Error(`Unknown pool mode: ${mode}`);
  return teams
    .filter((t) => mode === 'mixed' || t.type === mode)
    .map((t) => {
      const rating = resolved[t.id] || { ovr: null, stars: null };
      return { id: t.id, team: t, stars: rating.stars ?? null, ovr: rating.ovr ?? null, rating };
    });
}
