// 2D draw sequence (CSS 3D transforms + Web Animations API). Used when WebGL is missing,
// prefers-reduced-motion is set, or "Reduce effects" is on. Same contract the 3D scene will follow:
//
//   const seq = play2D(els, { animate: [bool, bool], fiveStar: [bool, bool], reduced })
//   seq.speedUp()  // x3 playback for the rest of the sequence
//   seq.skip()     // jump to the final state
//   await seq.finished
import { TIMING_2D } from '../config.js';

export function play2D(els, { animate = [true, true], fiveStar = [false, false], reduced = false } = {}) {
  const { flips, slots, vs, clash, bars, reveal } = els;
  let rate = 1;
  let skipped = false;
  const running = new Set();
  const k = reduced ? 0.25 : 1;

  function run(el, frames, opts) {
    if (!el || typeof el.animate !== 'function') return Promise.resolve();
    const a = el.animate(frames, { fill: 'both', ...opts, duration: Math.max(1, opts.duration * k) });
    a.playbackRate = rate;
    running.add(a);
    if (skipped) a.finish();
    return a.finished.catch(() => {}).finally(() => running.delete(a));
  }
  const wait = (ms) => (skipped ? Promise.resolve() : new Promise((r) => {
    const t0 = performance.now();
    const tick = (now) => (skipped || (now - t0) * rate >= ms * k ? r() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }));
  const show = (el) => el && el.classList.remove('pending');

  async function revealCard(i) {
    show(slots[i]);
    const spin = reduced
      ? [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }]
      : [
        { transform: 'translateY(24px) rotateY(540deg) scale(0.82)', opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { transform: 'translateY(0) rotateY(-10deg) scale(1.03)', offset: 0.82 },
        { transform: 'rotateY(0deg) scale(1)' },
      ];
    await run(flips[i], spin, { duration: TIMING_2D.cardFlip, easing: 'cubic-bezier(.16,.8,.3,1)' });
    if (fiveStar[i] && !reduced) {
      run(slots[i], [{ filter: 'brightness(2.2) drop-shadow(0 0 24px #ffd76a)' }, { filter: 'none' }], { duration: 600, easing: 'ease-out' });
    }
  }

  const finished = (async () => {
    // Locked sides are already visible; only the drawn sides spin in.
    for (let i = 0; i < 2; i++) if (!animate[i]) show(slots[i]);
    for (let i = 0; i < 2; i++) {
      if (!animate[i]) continue;
      await revealCard(i);
      await wait(TIMING_2D.cardPause);
    }
    show(clash);
    await Promise.all([
      run(vs, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'scale(2.6) rotate(-12deg)', opacity: 0 }, { transform: 'scale(0.9)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: TIMING_2D.vsIn, easing: 'ease-out' }),
      reduced ? null : run(clash, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 160, delay: TIMING_2D.vsIn * 0.55 }),
    ]);
    await Promise.all(bars.map((b) => run(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: TIMING_2D.bars, easing: 'cubic-bezier(.2,.8,.2,1)' })));
    for (const el of reveal) { show(el); run(el, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 250 }); }
  })();

  return {
    finished,
    speedUp() { rate = TIMING_2D.speedUp; for (const a of running) a.playbackRate = rate; },
    skip() { skipped = true; for (const a of [...running]) a.finish(); },
  };
}

/** True when the 3D scene should not be used. */
export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
