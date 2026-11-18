// Collect team ratings into src/data/ratings.json, then regenerate DATA_REPORT.md.
//
//   npm run fetch:ratings                 # FC version from src/config.js, visible Chrome window
//   npm run fetch:ratings -- --version fc26
//   npm run fetch:ratings -- --headless   # usually blocked by Cloudflare, see scripts/lib/browser.mjs
//   npm run fetch:ratings -- --no-cache   # re-download instead of using .cache/
//
// Sources, by priority (overrides.json is applied later, at report/app time):
//   1. fifaindex.com team OVR/ATK/MID/DEF (national teams list + one search per club)
//   2. eloratings.net Elo, mapped to the OVR scale by linear regression, for national teams
//      fifaindex does not have. att/mid/def stay null.
// Names are matched exactly via teams.json sourceAliases (fallback: `name`). No fuzzy matching.
import path from 'node:path';
import fs from 'node:fs';
import { openBrowser, BlockedError } from './lib/browser.mjs';
import { FIFAINDEX_BASE, teamsPath, parseTeamTable, nextPageHref } from './lib/fifaindex.mjs';
import { loadElo, linearRegression, ELO_WORLD_URL } from './lib/elo.mjs';
import { DATA_DIR, ROOT, loadTeams, writeJson } from './lib/paths.mjs';
import { writeReport } from './lib/report.mjs';
import { RATINGS_VERSION } from '../src/config.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const version = opt('--version', RATINGS_VERSION);
const useCache = !flag('--no-cache');
const sourceTag = `fifaindex-${version}`;

const teams = loadTeams();
const alias = (t, src) => (t.sourceAliases && t.sourceAliases[src]) || t.name;
const ratings = {};
const problems = [];

async function crawlFifaindex() {
  const b = await openBrowser({ headless: flag('--headless') });
  try {
    // National teams: walk every page of the men's list.
    const national = [];
    let url = `${FIFAINDEX_BASE}${teamsPath(version)}?category=men`;
    let lastFetched = null;
    while (url) {
      console.log('GET', url);
      const { html, fetchedAt } = await b.get(url, { useCache });
      lastFetched = fetchedAt;
      national.push(...parseTeamTable(html).filter((r) => !r.women));
      const next = nextPageHref(html);
      url = next ? new URL(next, FIFAINDEX_BASE).href : null;
    }
    console.log(`  ${national.length} national teams listed on fifaindex ${version}`);
    for (const t of teams.filter((x) => x.type === 'national')) {
      const hits = national.filter((r) => r.name === alias(t, 'fifaindex'));
      if (hits.length === 1) ratings[t.id] = row(hits[0], lastFetched);
      else if (hits.length > 1) problems.push(`${t.name}: ${hits.length} kết quả trùng tên trên fifaindex`);
    }
    // Clubs: one search per club, exact name match on men's teams only.
    for (const t of teams.filter((x) => x.type === 'club')) {
      const name = alias(t, 'fifaindex');
      const url = `${FIFAINDEX_BASE}${teamsPath(version)}?q=${encodeURIComponent(name)}`;
      console.log('GET', url);
      const { html, fetchedAt } = await b.get(url, { useCache });
      const hits = parseTeamTable(html).filter((r) => !r.women && r.name === name);
      if (hits.length === 1) ratings[t.id] = row(hits[0], fetchedAt);
      else problems.push(`${t.name}: ${hits.length ? hits.length + ' kết quả trùng tên' : 'không tìm thấy'} "${name}" trên fifaindex`);
    }
  } finally {
    await b.close();
  }
}

function row(r, fetchedAt) {
  return {
    ovr: r.ovr, att: r.att, mid: r.mid, def: r.def,
    source: sourceTag,
    sourceUrl: r.href ? new URL(r.href, FIFAINDEX_BASE).href : null,
    sourceName: r.name,
    fetchedAt,
  };
}

async function addElo() {
  const { byName, fetchedAt } = await loadElo({ useCache });
  const nationals = teams.filter((t) => t.type === 'national');
  const eloOf = (t) => byName.get(alias(t, 'elo')) || null;
  const missingElo = nationals.filter((t) => !eloOf(t)).map((t) => t.name);
  if (missingElo.length) problems.push(`Không tìm thấy trên eloratings: ${missingElo.join(', ')}`);

  const points = nationals.filter((t) => ratings[t.id] && eloOf(t)).map((t) => ({ id: t.id, name: t.name, x: eloOf(t).elo, y: ratings[t.id].ovr }));
  const need = nationals.filter((t) => !ratings[t.id] && eloOf(t));
  let regression = null;
  if (points.length >= 5) {
    regression = { ...linearRegression(points), teams: points.map((p) => ({ id: p.id, name: p.name, elo: p.x, ovr: p.y })) };
    for (const t of need) {
      const e = eloOf(t);
      ratings[t.id] = {
        ovr: Math.round(regression.a + regression.b * e.elo),
        att: null, mid: null, def: null,
        source: 'elo-mapped',
        sourceUrl: ELO_WORLD_URL,
        elo: e.elo,
        eloRank: e.rank,
        fetchedAt,
      };
    }
  } else if (need.length) {
    problems.push(`Chỉ có ${points.length} tuyển có cả 2 nguồn, không đủ để hồi quy Elo`);
  }
  // Elo for every national team, for reference in the report.
  const eloAll = Object.fromEntries(nationals.map((t) => [t.id, eloOf(t) ? eloOf(t).elo : null]));
  return { regression, eloAll, fetchedAt };
}

function writeCsvTemplate() {
  const file = path.join(ROOT, 'ratings_template.csv');
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = ['id,name,ovr,att,mid,def', ...teams.map((t) => [t.id, q(t.name), '', '', '', ''].join(','))];
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

try {
  await crawlFifaindex();
} catch (e) {
  if (e instanceof BlockedError) {
    const f = writeCsvTemplate();
    console.error(`\nfifaindex chặn truy cập: ${e.message}`);
    console.error(`Đã xuất ${path.relative(ROOT, f)}. Điền số rồi chạy: npm run import:csv -- ratings_template.csv`);
    process.exit(2);
  }
  throw e;
}
const elo = await addElo();

const out = {
  meta: {
    fifaindexVersion: version,
    generatedAt: new Date().toISOString(),
    eloRegression: elo.regression,
    eloFetchedAt: elo.fetchedAt,
    elo: elo.eloAll,
    problems,
  },
  teams: Object.fromEntries(teams.filter((t) => ratings[t.id]).map((t) => [t.id, ratings[t.id]])),
};
writeJson(path.join(DATA_DIR, 'ratings.json'), out);
console.log(`\nratings.json: ${Object.keys(out.teams).length}/${teams.length} teams rated`);
for (const p of problems) console.log('  !', p);
writeReport();
console.log('DATA_REPORT.md updated');
