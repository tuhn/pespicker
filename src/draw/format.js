// Small pure formatters. UI labels are passed in, so strings stay in ui/strings.js.

/** 4.5 -> "4.5", 5 -> "5" */
export const formatStars = (s) => (s == null ? null : Number.isInteger(s) ? String(s) : s.toFixed(1));

/** Player label: custom name, or the default label for that side. */
export const playerName = (players, side, defaults) => (players[side] && players[side].trim()) || defaults[side];
