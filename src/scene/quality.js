// Quality tiers + adaptive downgrade. Tier is remembered in localStorage for the next visit.
import { QUALITY } from '../config.js';

export const TIER_ORDER = ['high', 'medium', 'low'];
const KEY = 'pespicker:tier';

export function initialTier() {
  try {
    const saved = localStorage.getItem(KEY);
    if (TIER_ORDER.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  if (cores >= 8 && dpr >= 2) return 'high';
  if (cores >= 4) return 'medium';
  return 'low';
}

export function saveTier(tier) {
  try { localStorage.setItem(KEY, tier); } catch { /* ignore */ }
}

export const tierSettings = (tier) => QUALITY[tier];

/**
 * Watches frame times. If the rolling fps stays below `minFps` for `windowMs`, calls onDowngrade
 * with the next lower tier (once per tier). Frames longer than 250 ms (tab switch, GC pause on load)
 * are ignored so a single hitch does not drop quality.
 */
export class FpsMonitor {
  constructor(tier, onDowngrade) {
    this.tier = tier;
    this.onDowngrade = onDowngrade;
    this.lowSince = null;
    this.avg = 16.7;
    this.fps = 60;
  }

  frame(dt, now) {
    if (dt > 250) return;
    this.avg += (dt - this.avg) * 0.1;
    this.fps = 1000 / this.avg;
    if (this.fps < QUALITY.minFps) {
      if (this.lowSince == null) this.lowSince = now;
      else if (now - this.lowSince > QUALITY.downgradeAfterMs) this.downgrade();
    } else this.lowSince = null;
  }

  downgrade() {
    const i = TIER_ORDER.indexOf(this.tier);
    if (i >= TIER_ORDER.length - 1) return;
    this.tier = TIER_ORDER[i + 1];
    this.lowSince = null;
    this.avg = 16.7;
    saveTier(this.tier);
    this.onDowngrade(this.tier);
  }
}
