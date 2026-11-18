// Minimal easing + timeline. Delta-time driven (frame-rate independent), no allocations per frame.

export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  /** ease-out with a slight overshoot (s ~ 1.2 = gentle) */
  outBack: (t, s = 1.2) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * A timeline of tracks placed at absolute times (ms). Each track calls fn(easedT) every update
 * while active, and once with 1 when it ends (also when skipped), so end states are exact.
 *   const tl = new Timeline();
 *   tl.add(0, 800, (t) => ..., ease.outCubic);
 *   tl.call(800, () => ...);
 *   tl.update(dtMs)   // from the render loop
 *   tl.skip()         // apply every remaining track at its end state
 */
export class Timeline {
  constructor() {
    this.tracks = [];
    this.time = 0;
    this.rate = 1;
    this.done = false;
    this.duration = 0;
    this.finished = new Promise((r) => { this._resolve = r; });
  }

  add(at, duration, fn, easing = ease.linear) {
    this.tracks.push({ at, duration: Math.max(1, duration), fn, easing, state: 0 });
    this.duration = Math.max(this.duration, at + duration);
    return this;
  }

  call(at, fn) {
    this.tracks.push({ at, duration: 0, fn, easing: null, state: 0 });
    this.duration = Math.max(this.duration, at);
    return this;
  }

  update(dt) {
    if (this.done) return;
    this.time += dt * this.rate;
    for (const tr of this.tracks) {
      if (tr.state === 2 || this.time < tr.at) continue;
      if (tr.duration === 0) { tr.state = 2; tr.fn(); continue; }
      const t = clamp01((this.time - tr.at) / tr.duration);
      tr.state = t >= 1 ? 2 : 1;
      tr.fn(tr.easing(t), t);
    }
    if (this.time >= this.duration && this.tracks.every((t) => t.state === 2)) this._finish();
  }

  /** Jump to the end: run every remaining track in start order at t = 1. */
  skip() {
    if (this.done) return;
    const rest = this.tracks.filter((t) => t.state !== 2).sort((a, b) => a.at - b.at);
    for (const tr of rest) { tr.state = 2; if (tr.duration === 0) tr.fn(); else tr.fn(1, 1); }
    this.time = this.duration;
    this._finish();
  }

  _finish() { this.done = true; this._resolve(); }
}
