// World Football Elo Ratings (eloratings.net). Use the bare origin: the www. host fails CORS.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from './paths.mjs';

export const ELO_WORLD_URL = 'https://eloratings.net/World.tsv';
export const ELO_TEAMS_URL = 'https://eloratings.net/en.teams.tsv';

async function cachedText(url, name, useCache) {
  const file = path.join(CACHE_DIR, name);
  if (useCache && fs.existsSync(file)) return { text: fs.readFileSync(file, 'utf8'), fetchedAt: fs.statSync(file).mtime.toISOString() };
  const res = await fetch(url, { headers: { 'User-Agent': 'pespicker-ratings/1.0' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, text);
  return { text, fetchedAt: new Date().toISOString() };
}

/** Returns { byName: Map(name -> { code, elo, rank }), fetchedAt }. Names include all aliases in en.teams.tsv. */
export async function loadElo({ useCache = true } = {}) {
  const world = await cachedText(ELO_WORLD_URL, 'World.tsv', useCache);
  const teams = await cachedText(ELO_TEAMS_URL, 'en.teams.tsv', useCache);
  const byCode = new Map();
  for (const line of world.text.split('\n')) {
    const c = line.split('\t');
    if (c.length < 4) continue;
    const elo = parseInt(c[3], 10);
    if (Number.isFinite(elo)) byCode.set(c[2], { code: c[2], elo, rank: parseInt(c[0], 10) });
  }
  const byName = new Map();
  for (const line of teams.text.split('\n')) {
    const c = line.replace(/\r$/, '').split('\t');
    if (c.length < 2 || !byCode.has(c[0])) continue;
    for (const n of c.slice(1)) if (n && !byName.has(n)) byName.set(n, byCode.get(c[0]));
  }
  return { byName, fetchedAt: world.fetchedAt };
}

/** Ordinary least squares y = a + b x. Returns { a, b, r2, n }. */
export function linearRegression(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of points) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  const b = sxy / sxx;
  const a = my - b * mx;
  return { a, b, r2: (sxy * sxy) / (sxx * syy), n };
}
