// Randomness. Production uses crypto.getRandomValues; tests inject a seeded generator.
// An "rng" here is any object with randomInt(n) -> integer in [0, n).

/** Unbiased integer in [0, n) from crypto.getRandomValues (rejection sampling, no modulo bias). */
export function createCryptoRng(cryptoObj = globalThis.crypto) {
  const buf = new Uint32Array(1);
  return {
    randomInt(n) {
      if (!(n > 0) || n > 2 ** 32) throw new RangeError(`randomInt: bad n ${n}`);
      const limit = 2 ** 32 - (2 ** 32 % n);
      let x;
      do { cryptoObj.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    },
  };
}

/** Deterministic generator for tests (mulberry32). */
export function createSeededRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { randomInt: (n) => Math.floor(next() * n) };
}

/** Fisher-Yates, returns a new array. */
export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (list, rng) => list[rng.randomInt(list.length)];

/** Pick a key with probability proportional to its weight. entries: [[key, weight], ...] */
export function weightedPick(entries, rng) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.randomInt(total);
  for (const [k, w] of entries) { if (r < w) return k; r -= w; }
  return entries[entries.length - 1][0];
}
