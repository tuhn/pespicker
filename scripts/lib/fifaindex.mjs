// Parsers for fifaindex.com team listing pages (desktop <table> layout).
export const FIFAINDEX_BASE = 'https://fifaindex.com';

/** Listing path for a game version. FC 27 is the site default (/teams), older ones use /teams/fc26. */
export function teamsPath(version) {
  return version === 'fc27' ? '/teams' : `/teams/${version}`;
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/**
 * Parse the desktop table. Returns rows: { name, href, league, women, ovr, att, mid, def }.
 * Header order is read from <thead> so a column reorder on the site does not silently shift numbers.
 */
export function parseTeamTable(html) {
  const tStart = html.indexOf('<table');
  if (tStart < 0) return [];
  const table = html.slice(tStart, html.indexOf('</table>', tStart));
  const headers = [...table.slice(0, table.indexOf('</thead>')).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1].trim());
  const col = (n) => headers.indexOf(n);
  const need = ['Team', 'OVR', 'ATK', 'MID', 'DEF'];
  for (const n of need) if (col(n) < 0) throw new Error(`fifaindex table missing column ${n}; headers=${headers.join(',')}`);
  const rows = [];
  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < headers.length) continue;
    const teamCell = cells[col('Team')];
    const href = (teamCell.match(/href="([^"]+)"/) || [])[1] || null;
    const spans = [...teamCell.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => decode(m[1]));
    const name = spans[0];
    const women = spans.slice(1).includes('W');
    const text = (i) => decode(cells[i].replace(/<[^>]+>/g, ''));
    const num = (n) => {
      const v = parseInt(text(col(n)), 10);
      return Number.isFinite(v) ? v : null;
    };
    rows.push({
      name,
      href,
      league: col('League') >= 0 ? text(col('League')) : null,
      women,
      ovr: num('OVR'),
      att: num('ATK'),
      mid: num('MID'),
      def: num('DEF'),
    });
  }
  return rows;
}

/** Next page link, or null. */
export function nextPageHref(html) {
  const m = html.match(/href="([^"]*[?&](?:amp;)?page=\d+[^"]*)"[^>]*>\s*Next/);
  return m ? decode(m[1]) : null;
}
