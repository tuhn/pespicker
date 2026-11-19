import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, setMode, toggleLock, applyDraw, clearHistory, setBalance, setPlayerName,
  serialize, deserialize, createPersistence,
} from '../src/state.js';
import { formatStars, playerName } from '../src/draw/format.js';

const drawn = (s, teams) => applyDraw(s, { ok: true, teams, notice: null }, 1000);

test('changing mode clears both locks', () => {
  let s = drawn(initialState(), ['brazil', 'france']);
  s = toggleLock(toggleLock(s, 0), 1);
  assert.deepEqual(s.result.locked, [true, true]);
  s = setMode(s, 'club');
  assert.equal(s.mode, 'club');
  assert.deepEqual(s.result.locked, [false, false]);
});

test('same mode is a no-op and keeps locks', () => {
  let s = toggleLock(drawn(initialState(), ['a', 'b']), 0);
  assert.equal(setMode(s, s.mode), s);
});

test('locks survive a redraw', () => {
  let s = toggleLock(drawn(initialState(), ['brazil', 'france']), 0);
  s = drawn(s, ['brazil', 'spain']);
  assert.deepEqual(s.result.locked, [true, false]);
});

test('history keeps the 20 newest and can be cleared', () => {
  let s = initialState();
  for (let i = 0; i < 25; i++) s = applyDraw(s, { ok: true, teams: [`a${i}`, `b${i}`] }, i);
  assert.equal(s.history.length, 20);
  assert.deepEqual(s.history[0].teams, ['a24', 'b24']);
  assert.equal(clearHistory(s).history.length, 0);
});

test('failed draw changes nothing', () => {
  const s = initialState();
  assert.equal(applyDraw(s, { ok: false, error: { code: 'no-tier' } }), s);
});

test('balance validation', () => {
  assert.deepEqual(setBalance(initialState(), { mode: 'gap', gap: 1.5 }).balance, { mode: 'gap', gap: 1.5 });
  assert.deepEqual(setBalance(initialState(), { mode: 'gap', gap: 7 }).balance, { mode: 'gap', gap: 1 });
  assert.deepEqual(setBalance(initialState(), { mode: 'same-tier', gap: 1 }).balance, { mode: 'same-tier' });
});

test('serialize/deserialize round trip, result is not persisted', () => {
  let s = setPlayerName(drawn(initialState(), ['a', 'b']), 0, 'Nam');
  s = setMode(s, 'national');
  const back = deserialize(serialize(s));
  assert.equal(back.mode, 'national');
  assert.deepEqual(back.players, ['Nam', '']);
  assert.equal(back.result, null);
  assert.equal(back.history.length, 1);
});

test('garbage in storage falls back to defaults', () => {
  assert.deepEqual(deserialize('{not json'), initialState());
  assert.equal(deserialize(JSON.stringify({ mode: 'weird', balance: { mode: 'x' } })).mode, 'mixed');
});

test('throwing storage does not break the app', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  const p = createPersistence(bad);
  assert.deepEqual(p.load(), initialState());
  assert.equal(p.save(initialState()), false);
  const none = createPersistence(null);
  assert.deepEqual(none.load(), initialState());
});

test('player names and star formatting', () => {
  assert.equal(playerName(['Nam', ''], 0, ['Player 1', 'Player 2']), 'Nam');
  assert.equal(playerName(['  ', ''], 0, ['Player 1', 'Player 2']), 'Player 1');
  assert.equal(formatStars(5), '5');
  assert.equal(formatStars(4.5), '4.5');
});
