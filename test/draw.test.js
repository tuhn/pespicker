import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { drawMatch, ovrGap, canRedraw } from '../src/draw/draw.js';
import { buildPool } from '../src/draw/pool.js';
import { createSeededRng, createCryptoRng, shuffle } from '../src/draw/rng.js';
import { resolveRatings } from '../src/draw/stars.js';
import { STAR_THRESHOLDS } from '../src/config.js';

// Synthetic pool: id -> stars
const mk = (spec) => Object.entries(spec).map(([id, stars]) => ({ id, team: { id, name: id }, stars, ovr: stars == null ? null : 60 + stars * 5, rating: {} }));
const POOL = mk({ a5: 5, b5: 5, c45: 4.5, d4: 4, e4: 4, f3: 3, g2: 2, h1: 1, u1: null, u2: null });
const byId = Object.fromEntries(POOL.map((e) => [e.id, e]));
const N = 3000;

function many(opts, n = N, seed = 7) {
  const rng = createSeededRng(seed);
  return Array.from({ length: n }, () => drawMatch({ pool: POOL, rng, ...opts }));
}

describe('mirror', () => {
  test('never draws the same team twice when mirror is off (every mode, also tiny pools)', () => {
    for (const balance of [{ mode: 'free' }, { mode: 'same-tier' }, { mode: 'gap', gap: 0.5 }, { mode: 'gap', gap: 1 }, { mode: 'gap', gap: 1.5 }]) {
      for (const r of many({ balance, allowMirror: false })) {
        assert.ok(r.ok, JSON.stringify(r));
        assert.notEqual(r.teams[0], r.teams[1]);
      }
    }
    const tiny = mk({ x: 3, y: 3 });
    const rng = createSeededRng(3);
    for (let i = 0; i < 500; i++) {
      const r = drawMatch({ pool: tiny, balance: { mode: 'free' }, rng });
      assert.notEqual(r.teams[0], r.teams[1]);
    }
  });

  test('a locked team is never drawn again for the other side when mirror is off', () => {
    const rng = createSeededRng(11);
    for (let i = 0; i < N; i++) {
      const r = drawMatch({ pool: POOL, balance: { mode: 'same-tier' }, current: ['a5', null], locked: [true, false], rng });
      assert.equal(r.teams[0], 'a5');
      assert.equal(r.teams[1], 'b5'); // only other 5★
    }
  });

  test('mirror on allows the same team and works with a 1-team pool', () => {
    const r = many({ balance: { mode: 'free' }, allowMirror: true });
    assert.ok(r.some((x) => x.teams[0] === x.teams[1]));
    const one = mk({ solo: 3 });
    const res = drawMatch({ pool: one, balance: { mode: 'free' }, allowMirror: true, rng: createSeededRng(1) });
    assert.deepEqual(res.teams, ['solo', 'solo']);
  });

  test('pool too small with mirror off is an error, not a duplicate', () => {
    const one = mk({ solo: 3 });
    const r = drawMatch({ pool: one, balance: { mode: 'free' }, rng: createSeededRng(1) });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'pool-too-small');
  });
});

describe('locks', () => {
  test('lock P1: P1 keeps its team, only P2 changes', () => {
    const rng = createSeededRng(5);
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const r = drawMatch({ pool: POOL, balance: { mode: 'free' }, current: ['d4', 'e4'], locked: [true, false], rng });
      assert.equal(r.teams[0], 'd4');
      seen.add(r.teams[1]);
    }
    assert.ok(seen.size > 3);
    assert.ok(!seen.has('d4'));
  });

  test('lock P2 works the same way', () => {
    const r = drawMatch({ pool: POOL, balance: { mode: 'gap', gap: 1 }, current: ['a5', 'f3'], locked: [false, true], rng: createSeededRng(2) });
    assert.equal(r.teams[1], 'f3');
    assert.ok(Math.abs(byId[r.teams[0]].stars - 3) <= 1);
  });

  test('both locked -> error and redraw disabled', () => {
    const r = drawMatch({ pool: POOL, current: ['a5', 'b5'], locked: [true, true], rng: createSeededRng(1) });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'both-locked');
    assert.equal(canRedraw([true, true]), false);
    assert.equal(canRedraw([true, false]), true);
  });

  test('locked team missing from the pool is reported', () => {
    const r = drawMatch({ pool: POOL, current: ['nope', null], locked: [true, false], rng: createSeededRng(1) });
    assert.equal(r.error.code, 'locked-not-in-pool');
  });
});

describe('balance modes', () => {
  test('free: unrated teams can appear', () => {
    const ids = new Set(many({ balance: { mode: 'free' } }).flatMap((r) => r.teams));
    assert.ok(ids.has('u1') && ids.has('u2'));
  });

  test('non-free modes never use stars: null teams', () => {
    for (const balance of [{ mode: 'same-tier' }, { mode: 'gap', gap: 1 }]) {
      for (const r of many({ balance })) assert.ok(!r.teams.some((id) => byId[id].stars == null), JSON.stringify(r));
    }
  });

  test('same tier: both teams share the star level, only tiers with >= 2 teams', () => {
    const tiers = new Set();
    for (const r of many({ balance: { mode: 'same-tier' } })) {
      assert.equal(byId[r.teams[0]].stars, byId[r.teams[1]].stars);
      tiers.add(byId[r.teams[0]].stars);
    }
    assert.deepEqual([...tiers].sort(), [4, 5]); // 4.5, 3, 2, 1 have a single team
  });

  test('same tier is weighted by team count', () => {
    const pool = mk({ a: 5, b: 5, c: 3, d: 3, e: 3, f: 3, g: 3, h: 3 });
    const rng = createSeededRng(9);
    let three = 0;
    for (let i = 0; i < N; i++) {
      const id = drawMatch({ pool, balance: { mode: 'same-tier' }, rng }).teams[0];
      if (pool.find((e) => e.id === id).stars === 3) three++;
    }
    assert.ok(Math.abs(three / N - 0.75) < 0.04, `3★ share ${three / N}`);
  });

  test('same tier with a lock uses the locked team tier', () => {
    const rng = createSeededRng(4);
    for (let i = 0; i < 300; i++) {
      const r = drawMatch({ pool: POOL, balance: { mode: 'same-tier' }, current: [null, 'd4'], locked: [false, true], rng });
      assert.equal(r.teams[0], 'e4');
    }
  });

  test('tier with too few teams -> clear error', () => {
    const r = drawMatch({ pool: POOL, balance: { mode: 'same-tier' }, current: ['c45', null], locked: [true, false], rng: createSeededRng(1) });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'no-tier');
    assert.equal(r.error.stars, 4.5);
    const flat = mk({ a: 1, b: 2, c: 3 });
    assert.equal(drawMatch({ pool: flat, balance: { mode: 'same-tier' }, rng: createSeededRng(1) }).error.code, 'no-tier');
  });

  test('locked unrated team in a non-free mode -> error', () => {
    const r = drawMatch({ pool: POOL, balance: { mode: 'gap', gap: 1 }, current: ['u1', null], locked: [true, false], rng: createSeededRng(1) });
    assert.equal(r.error.code, 'locked-unrated');
  });

  for (const gap of [0.5, 1, 1.5]) {
    test(`max gap ${gap}★ holds whenever nothing was widened`, () => {
      for (const r of many({ balance: { mode: 'gap', gap } })) {
        const d = Math.abs(byId[r.teams[0]].stars - byId[r.teams[1]].stars);
        if (!r.notice) assert.ok(d <= gap, `${r.teams} diff ${d}`);
        else assert.ok(d <= r.notice.to && r.notice.to > gap);
      }
    });
  }

  test('max gap with lock is measured from the locked team', () => {
    const rng = createSeededRng(8);
    for (let i = 0; i < 500; i++) {
      const r = drawMatch({ pool: POOL, balance: { mode: 'gap', gap: 0.5 }, current: ['c45', null], locked: [true, false], rng });
      assert.ok(Math.abs(byId[r.teams[1]].stars - 4.5) <= 0.5);
      assert.equal(r.notice, null);
    }
  });

  test('max gap widens with a notice when nothing fits', () => {
    // h1 (1★) locked, gap 0.5: nearest other team is g2 (2★) -> widened to 1
    const r = drawMatch({ pool: POOL, balance: { mode: 'gap', gap: 0.5 }, current: ['h1', null], locked: [true, false], rng: createSeededRng(1) });
    assert.equal(r.teams[1], 'g2');
    assert.deepEqual(r.notice, { code: 'gap-widened', from: 0.5, to: 1 });
  });

  test('random side assignment: each team appears on both sides', () => {
    const sides = { 0: new Set(), 1: new Set() };
    for (const r of many({ balance: { mode: 'gap', gap: 1 } })) { sides[0].add(r.teams[0]); sides[1].add(r.teams[1]); }
    assert.equal(sides[0].size, sides[1].size);
  });
});

describe('helpers', () => {
  test('ovrGap', () => {
    assert.equal(ovrGap({ ovr: 84 }, { ovr: 86 }), 2);
    assert.equal(ovrGap({ ovr: null }, { ovr: 86 }), null);
  });

  test('crypto rng stays in range and covers all values', () => {
    const rng = createCryptoRng();
    const seen = new Set();
    for (let i = 0; i < 2000; i++) { const v = rng.randomInt(7); assert.ok(v >= 0 && v < 7); seen.add(v); }
    assert.equal(seen.size, 7);
  });

  test('shuffle keeps every element', () => {
    const a = [1, 2, 3, 4, 5, 6];
    assert.deepEqual(shuffle(a, createSeededRng(1)).sort(), a);
  });
});

describe('real data', () => {
  const teams = JSON.parse(fs.readFileSync(new URL('../src/data/teams.json', import.meta.url)));
  const ratings = JSON.parse(fs.readFileSync(new URL('../src/data/ratings.json', import.meta.url))).teams;
  const overrides = JSON.parse(fs.readFileSync(new URL('../src/data/overrides.json', import.meta.url)));
  const resolved = resolveRatings(teams, ratings, overrides, STAR_THRESHOLDS);

  test('pool sizes per mode', () => {
    assert.equal(buildPool(teams, resolved, 'national').length, 48);
    assert.equal(buildPool(teams, resolved, 'club').length, 37);
    assert.equal(buildPool(teams, resolved, 'mixed').length, 85);
  });

  test('every mode x balance draws two different teams from the right pool', () => {
    const rng = createCryptoRng();
    for (const mode of ['national', 'club', 'mixed']) {
      const pool = buildPool(teams, resolved, mode);
      const ids = new Set(pool.map((e) => e.id));
      for (const balance of [{ mode: 'free' }, { mode: 'same-tier' }, { mode: 'gap', gap: 0.5 }, { mode: 'gap', gap: 1 }, { mode: 'gap', gap: 1.5 }]) {
        for (let i = 0; i < 400; i++) {
          const r = drawMatch({ pool, balance, rng });
          assert.ok(r.ok, `${mode} ${balance.mode}: ${JSON.stringify(r.error)}`);
          assert.notEqual(r.teams[0], r.teams[1]);
          assert.ok(ids.has(r.teams[0]) && ids.has(r.teams[1]));
        }
      }
    }
  });
});
