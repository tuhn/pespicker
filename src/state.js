// App state: pure transitions + localStorage persistence (falls back to in-memory on any error).
import { DEFAULT_BALANCE, HISTORY_LIMIT } from './config.js';
import { POOL_MODES } from './draw/pool.js';
import { BALANCE_MODES, GAP_OPTIONS } from './draw/draw.js';

const STORAGE_KEY = 'pespicker:v1';

export function initialState() {
  return {
    mode: 'mixed',
    players: ['', ''], // '' = use the default label ("Player 1" / "Player 2")
    allowMirror: false,
    balance: { ...DEFAULT_BALANCE },
    reduceEffects: false,
    result: null, // { teams: [idP1, idP2], locked: [bool, bool], notice } (not persisted)
    history: [], // newest first: { at, mode, balance, players, teams }
  };
}

// ---------- transitions (return a new state, never mutate) ----------

/** Changing the pool mode clears both locks (CLAUDE.md). The last result stays visible. */
export function setMode(s, mode) {
  if (!POOL_MODES.includes(mode) || mode === s.mode) return s;
  return { ...s, mode, result: s.result ? { ...s.result, locked: [false, false] } : null };
}

export function setPlayerName(s, side, name) {
  const players = s.players.slice();
  players[side] = String(name ?? '').slice(0, 24);
  return { ...s, players };
}

export function setBalance(s, balance) {
  if (!BALANCE_MODES.includes(balance.mode)) return s;
  const gap = balance.mode === 'gap' ? (GAP_OPTIONS.includes(balance.gap) ? balance.gap : DEFAULT_BALANCE.gap) : undefined;
  return { ...s, balance: balance.mode === 'gap' ? { mode: 'gap', gap } : { mode: balance.mode } };
}

export const setAllowMirror = (s, on) => ({ ...s, allowMirror: !!on });
export const setReduceEffects = (s, on) => ({ ...s, reduceEffects: !!on });

export function toggleLock(s, side) {
  if (!s.result) return s;
  const locked = s.result.locked.slice();
  locked[side] = !locked[side];
  return { ...s, result: { ...s.result, locked } };
}

/** Swap the two drawn teams between players. A lock belongs to its team, so it moves too. */
export function swapSides(s) {
  if (!s.result) return s;
  const { teams, locked } = s.result;
  return { ...s, result: { ...s.result, teams: [teams[1], teams[0]], locked: [locked[1], locked[0]] } };
}

/** Store a successful drawMatch() result and log it to history. */
export function applyDraw(s, draw, now = Date.now()) {
  if (!draw.ok) return s;
  const locked = s.result ? s.result.locked.slice() : [false, false];
  const entry = { at: now, mode: s.mode, balance: { ...s.balance }, players: s.players.slice(), teams: draw.teams.slice() };
  return {
    ...s,
    result: { teams: draw.teams.slice(), locked, notice: draw.notice || null },
    history: [entry, ...s.history].slice(0, HISTORY_LIMIT),
  };
}

export const clearHistory = (s) => ({ ...s, history: [] });

// ---------- persistence ----------

const PERSISTED = ['mode', 'players', 'allowMirror', 'balance', 'reduceEffects', 'history'];

export function serialize(s) {
  return JSON.stringify(Object.fromEntries(PERSISTED.map((k) => [k, s[k]])));
}

/** Parse stored JSON defensively; anything malformed falls back to the default for that field. */
export function deserialize(json) {
  const base = initialState();
  let raw;
  try { raw = JSON.parse(json); } catch { return base; }
  if (!raw || typeof raw !== 'object') return base;
  let s = base;
  if (POOL_MODES.includes(raw.mode)) s = { ...s, mode: raw.mode };
  if (Array.isArray(raw.players) && raw.players.length === 2) s = setPlayerName(setPlayerName(s, 0, raw.players[0]), 1, raw.players[1]);
  if (typeof raw.allowMirror === 'boolean') s = setAllowMirror(s, raw.allowMirror);
  if (typeof raw.reduceEffects === 'boolean') s = setReduceEffects(s, raw.reduceEffects);
  if (raw.balance && typeof raw.balance === 'object') s = setBalance(s, raw.balance);
  if (Array.isArray(raw.history)) {
    const ok = raw.history.filter((h) => h && Array.isArray(h.teams) && h.teams.length === 2 && Number.isFinite(h.at));
    s = { ...s, history: ok.slice(0, HISTORY_LIMIT) };
  }
  return s;
}

/**
 * Wraps a Storage-like object. Every access is try/catch'd: private mode, quota errors or a
 * missing localStorage just mean the app keeps working with in-memory state.
 */
export function createPersistence(storage = safeLocalStorage()) {
  return {
    load() {
      try { const v = storage && storage.getItem(STORAGE_KEY); return v ? deserialize(v) : initialState(); } catch { return initialState(); }
    },
    save(s) {
      try { storage && storage.setItem(STORAGE_KEY, serialize(s)); return true; } catch { return false; }
    },
  };
}

function safeLocalStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
