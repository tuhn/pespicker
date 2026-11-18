import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ovrToStars, quantileThresholds, resolveRatings } from '../src/draw/stars.js';

const T = [73, 76, 77, 78, 79, 80, 82, 84];

test('ovrToStars maps edges and null', () => {
  assert.equal(ovrToStars(60, T), 1);
  assert.equal(ovrToStars(73, T), 1.5);
  assert.equal(ovrToStars(83, T), 4.5);
  assert.equal(ovrToStars(84, T), 5);
  assert.equal(ovrToStars(99, T), 5);
  assert.equal(ovrToStars(null, T), null);
});

test('quantileThresholds never leaves a level empty with >= 9 distinct values', () => {
  const ovrs = [60, 61, 62, 70, 70, 70, 70, 75, 75, 75, 76, 79, 79, 79, 79, 80, 84, 86, 86];
  const th = quantileThresholds(ovrs);
  assert.equal(th.length, 8);
  for (let i = 1; i < th.length; i++) assert.ok(th[i] > th[i - 1], 'strictly increasing');
  const counts = new Map();
  for (const o of ovrs) counts.set(ovrToStars(o, th), (counts.get(ovrToStars(o, th)) || 0) + 1);
  assert.equal(counts.size, 9);
});

test('overrides win and may set stars without OVR', () => {
  const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ratings = { a: { ovr: 80, att: 80, mid: 80, def: 80, source: 'fifaindex-fc27' }, b: { ovr: 75, source: 'elo-mapped' } };
  const overrides = { a: { ovr: 85 }, c: { stars: 2.5 } };
  const r = resolveRatings(teams, ratings, overrides, T);
  assert.equal(r.a.ovr, 85);
  assert.equal(r.a.att, 80);
  assert.equal(r.a.stars, 5);
  assert.equal(r.a.source, 'override');
  assert.equal(r.b.estimated, true);
  assert.equal(r.c.stars, 2.5);
  assert.equal(r.c.ovr, null);
});
