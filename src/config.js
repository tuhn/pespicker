// App-wide configuration. Shared by the app and by the Node scripts (no DOM access here).

/** fifaindex game version used by `npm run fetch:ratings`: 'fc27' (default) or 'fc26'. */
export const RATINGS_VERSION = 'fc27';

/**
 * Minimum OVR needed for each star level, from 1.5★ up to 5★ (8 values, ascending).
 * Below the first value a team is 1★. Step is 0.5★.
 * Initial values = quantiles over every rated team (see DATA_REPORT.md "Ngưỡng sao").
 * Edit by hand freely; `npm run report` shows the resulting distribution.
 */
//                     1.5★ 2★  2.5★ 3★  3.5★ 4★  4.5★ 5★
export const STAR_THRESHOLDS = [73, 76, 77, 78, 79, 80, 82, 84];

/** Show club crests on cards (false = monogram badge on club colors). */
export const SHOW_CLUB_LOGOS = true;

/** Default balance mode: 'free' | 'same-tier' | 'gap'. */
export const DEFAULT_BALANCE = { mode: 'gap', gap: 1 };

/** Number of history entries kept. */
export const HISTORY_LIMIT = 20;

/**
 * 2D (CSS) draw sequence timings in ms. Used by the fallback and with "Reduce effects".
 * Total = 2 x (cardFlip + cardPause) + vsIn + bars, kept well under the 6 s screen budget.
 */
export const TIMING_2D = {
  cardFlip: 1100, // card spins in (1.5 turns) for one side
  cardPause: 250, // pause before the next side
  vsIn: 450, // VS badge slam
  bars: 700, // comparison bars grow
  speedUp: 3, // playback rate while the screen is held/tapped
};

/**
 * 3D draw sequence timings in ms (CLAUDE.md budget: boot <= 0.8 s, each card <= 2 s,
 * clash <= 1.8 s, whole screen <= 6 s).
 */
export const TIMING_3D = {
  boot: 800, // stadium builds bottom-up + camera dolly
  cardScan: 350, // card scans in (back facing)
  cardSpin: 950, // 1.5 turns, ends on the front with a slight overshoot
  cardFlash: 300, // 5★ gold flash + pitch wave (overlaps the slide)
  cardSlide: 450, // card shrinks and slides to its player's half
  cardPause: 100,
  clashRush: 350, // cards rush to the centre
  clashImpact: 120, // white flash, shockwave, shake (<= 150 ms), VS pops
  clashSeparate: 450, // cards return to their halves
  bars: 500, // comparison bars + gap line
  speedUp: 3,
};

/** Quality tiers. Chosen from DPR + cores, then by a ~1 s benchmark at boot, then adaptively. */
export const QUALITY = {
  high: { dpr: 2, particles: 900, antialias: true },
  medium: { dpr: 1.5, particles: 500, antialias: false },
  low: { dpr: 1, particles: 220, antialias: false },
  minFps: 45, // below this ...
  downgradeAfterMs: 1500, // ... for this long -> drop one tier
};
