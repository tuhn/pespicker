// Text formatting for copy/share. Pure; UI labels are passed in, so strings stay in ui/strings.js.

/** 4.5 -> "4.5", 5 -> "5" */
export const formatStars = (s) => (s == null ? null : Number.isInteger(s) ? String(s) : s.toFixed(1));

/** "Brazil ★4.5 · OVR 84" (+ " est." for Elo-estimated OVR). Missing parts are left out. */
export function formatTeam(entry) {
  const parts = [entry.team.name];
  if (entry.stars != null) parts[0] += ` ★${formatStars(entry.stars)}`;
  if (entry.ovr != null) parts.push(`OVR ${entry.ovr}${entry.rating?.estimated ? ' est.' : ''}`);
  return parts.join(' · ');
}

/** `Nam (Brazil ★4.5 · OVR 84) vs Minh (France ★5 · OVR 86)` */
export function formatMatch(names, entries) {
  return `${names[0]} (${formatTeam(entries[0])}) vs ${names[1]} (${formatTeam(entries[1])})`;
}

/** Player label: custom name, or the default label for that side. */
export const playerName = (players, side, defaults) => (players[side] && players[side].trim()) || defaults[side];
