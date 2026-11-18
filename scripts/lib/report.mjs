// Builds DATA_REPORT.md (Vietnamese) from teams.json + ratings.json + overrides.json + asset sources.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, ASSETS_DIR, readJson, loadTeams } from './paths.mjs';
import { STAR_THRESHOLDS } from '../../src/config.js';
import { STAR_LEVELS, quantileThresholds, resolveRatings } from '../../src/draw/stars.js';

const MANUAL_START = '<!-- manual:performance -->';
const MANUAL_END = '<!-- /manual:performance -->';

export function writeReport() {
  const teams = loadTeams();
  const ratingsFile = path.join(DATA_DIR, 'ratings.json');
  const ratings = fs.existsSync(ratingsFile) ? readJson(ratingsFile) : { meta: {}, teams: {} };
  const overrides = readJson(path.join(DATA_DIR, 'overrides.json'));
  const sourcesFile = path.join(ASSETS_DIR, 'sources.json');
  const assetSources = fs.existsSync(sourcesFile) ? readJson(sourcesFile) : null;

  // Quantiles use every team with an OVR after overrides, clubs and national teams together (one scale).
  const ovrAfterOverride = teams.map((t) => (overrides[t.id] && 'ovr' in overrides[t.id] ? overrides[t.id].ovr : ratings.teams[t.id]?.ovr ?? null));
  const quantiles = quantileThresholds(ovrAfterOverride.filter((v) => v != null));
  const configured = STAR_THRESHOLDS.some((v) => v > 0);
  const thresholds = configured ? STAR_THRESHOLDS : quantiles;
  const resolved = resolveRatings(teams, ratings.teams, overrides, thresholds);

  const L = [];
  const meta = ratings.meta || {};
  L.push('# DATA_REPORT', '');
  L.push(`Sinh tự động bởi \`npm run fetch:ratings\` / \`npm run report\`. Lần chạy: ${new Date().toISOString()}.`, '');
  L.push(`- Nguồn chính: fifaindex.com, bản **${(meta.fifaindexVersion || '?').toUpperCase()}**. Dữ liệu fifaindex lấy lúc: ${fmtRange(Object.values(ratings.teams).filter((r) => r.source?.startsWith('fifaindex')).map((r) => r.fetchedAt))}.`);
  L.push(`- Elo: eloratings.net (World.tsv), lấy lúc ${meta.eloFetchedAt || '?'}.`);
  L.push('- Rating EA FC chỉ là proxy để xếp sao, thang khác engine PES.', '');

  // Summary
  const bySource = {};
  for (const t of teams) { const s = resolved[t.id].source || 'thiếu'; bySource[s] = (bySource[s] || 0) + 1; }
  L.push('## Tóm tắt', '');
  L.push('| Nguồn | Số đội |', '|---|---:|');
  for (const [s, n] of Object.entries(bySource)) L.push(`| ${s} | ${n} |`);
  L.push(`| **Tổng** | **${teams.length}** |`, '');

  const missing = teams.filter((t) => resolved[t.id].stars == null);
  L.push('## Đội thiếu rating', '');
  L.push(missing.length ? missing.map((t) => `- ${t.name} (\`${t.id}\`): không có ở fifaindex, eloratings hay overrides. Chỉ xuất hiện ở chế độ "Free".`).join('\n') : 'Không có. Mọi đội đều có rating từ fifaindex, elo-mapped hoặc override.');
  L.push('');
  if (meta.problems?.length) {
    L.push('### Vấn đề khi thu thập', '', ...meta.problems.map((p) => `- ${p}`), '');
  }

  // Thresholds
  L.push('## Ngưỡng sao', '');
  L.push('OVR tối thiểu cho từng mức (dưới mức 1.5★ là 1★). Club và tuyển dùng chung một thang.', '');
  L.push(`| Mức | ${STAR_LEVELS.slice(1).map((s) => s + '★').join(' | ')} |`, `|---|${STAR_LEVELS.slice(1).map(() => '---:').join('|')}|`);
  L.push(`| Quantile (gợi ý) | ${(quantiles || []).join(' | ')} |`);
  L.push(`| Đang dùng (config.js) | ${configured ? STAR_THRESHOLDS.join(' | ') : '_chưa đặt, đang dùng quantile_'} |`, '');

  // Distribution
  L.push('## Phân bố số đội theo mức sao', '');
  L.push('| Sao | National | Clubs | Mixed |', '|---|---:|---:|---:|');
  for (const s of [...STAR_LEVELS].reverse()) {
    const c = (type) => teams.filter((t) => (!type || t.type === type) && resolved[t.id].stars === s).length;
    L.push(`| ${s}★ | ${c('national')} | ${c('club')} | ${c(null)} |`);
  }
  const nullCount = (type) => teams.filter((t) => (!type || t.type === type) && resolved[t.id].stars == null).length;
  L.push(`| null | ${nullCount('national')} | ${nullCount('club')} | ${nullCount(null)} |`, '');
  const thin = [];
  for (const [label, type] of [['National', 'national'], ['Clubs', 'club'], ['Mixed', null]]) {
    const lv = STAR_LEVELS.filter((s) => teams.filter((t) => (!type || t.type === type) && resolved[t.id].stars === s).length === 1);
    if (lv.length) thin.push(`- ${label}: mức ${lv.map((s) => s + '★').join(', ')} chỉ có 1 đội, "Same tier" sẽ không chọn mức này.`);
  }
  if (thin.length) L.push(...thin, '');

  // Elo regression
  const reg = meta.eloRegression;
  L.push('## Quy đổi Elo sang OVR', '');
  if (reg) {
    L.push(`Hồi quy tuyến tính \`OVR = a + b × Elo\` trên ${reg.n} tuyển có cả fifaindex và Elo:`, '');
    L.push(`- a = ${reg.a.toFixed(3)}`, `- b = ${reg.b.toFixed(5)}`, `- R² = ${reg.r2.toFixed(3)}`, '');
    L.push('<details><summary>Các tuyển dùng để hồi quy</summary>', '', '| Đội | Elo | OVR fifaindex | OVR dự đoán | Sai số |', '|---|---:|---:|---:|---:|');
    for (const p of reg.teams) { const pred = reg.a + reg.b * p.elo; L.push(`| ${p.name} | ${p.elo} | ${p.ovr} | ${pred.toFixed(1)} | ${(p.ovr - pred).toFixed(1)} |`); }
    L.push('', '</details>', '');
    const mapped = teams.filter((t) => ratings.teams[t.id]?.source === 'elo-mapped');
    L.push('Tuyển được quy đổi (hiện nhãn "est." trong app):', '', '| Đội | Elo | OVR ước lượng |', '|---|---:|---:|');
    for (const t of mapped) L.push(`| ${t.name} | ${ratings.teams[t.id].elo} | ${ratings.teams[t.id].ovr} |`);
    L.push('');
  } else L.push('Chưa có dữ liệu hồi quy.', '');

  // Full table
  for (const [title, type] of [['Rating đội tuyển', 'national'], ['Rating CLB', 'club']]) {
    L.push(`## ${title}`, '', '| Đội | OVR | ATT | MID | DEF | Sao | Nguồn | Tên trên nguồn |', '|---|---:|---:|---:|---:|---:|---|---|');
    const list = teams.filter((t) => t.type === type).sort((a, b) => (resolved[b.id].ovr ?? -1) - (resolved[a.id].ovr ?? -1));
    for (const t of list) {
      const r = resolved[t.id];
      const raw = ratings.teams[t.id];
      const src = r.sourceUrl && r.source !== 'override' ? `[${r.source}](${r.sourceUrl})` : r.source || '—';
      L.push(`| ${t.name} | ${v(r.ovr)}${r.estimated ? ' est.' : ''} | ${v(r.att)} | ${v(r.mid)} | ${v(r.def)} | ${r.stars ?? '—'} | ${src} | ${raw?.sourceName && raw.sourceName !== t.name ? raw.sourceName : ''} |`);
    }
    L.push('');
  }

  // Logos
  L.push('## Logo và cờ', '');
  if (assetSources) {
    const clubs = teams.filter((t) => t.type === 'club');
    const missingLogos = clubs.filter((t) => !assetSources.logos?.[t.id]?.file);
    L.push(`- Cờ: ${Object.keys(assetSources.flags || {}).length} file SVG từ package flag-icons.`);
    L.push(`- Logo CLB: ${clubs.length - missingLogos.length}/${clubs.length} có file. Nguồn từng logo xem ASSET_SOURCES.md.`);
    if (missingLogos.length) L.push(`- Thiếu logo (dùng badge monogram): ${missingLogos.map((t) => `${t.name} (${assetSources.logos?.[t.id]?.error || 'không rõ'})`).join(', ')}`);
    const raster = clubs.filter((t) => assetSources.logos?.[t.id]?.format === 'webp');
    if (raster.length) L.push(`- Logo chuyển sang WebP 128px (SVG gốc quá nặng hoặc gốc là ảnh raster): ${raster.map((t) => t.name).join(', ')}`);
    L.push(`- Tổng dung lượng asset: cờ ${kb(assetSources.totals?.flags)}, logo ${kb(assetSources.totals?.logos)}.`);
  } else L.push('Chưa chạy `npm run fetch:assets`.');
  L.push('');

  L.push('## Ghi chú data', '');
  L.push('- `shortName` đội tuyển là mã FIFA 3 chữ. `shortName` CLB là viết tắt thông dụng trên broadcast (Lyon `OL`, Marseille `OM` giữ 2 chữ theo cách gọi phổ biến).');
  L.push('- `colors` là màu áo chính/phụ ở mức gần đúng, dùng cho viền card và badge dự phòng, không phải mã màu thương hiệu chính thức. Sửa trực tiếp trong teams.json nếu thấy lệch.');
  L.push('- AC Milan trên fifaindex FC 27 mang tên "Milano FC" (không có bản quyền tên). Đã xác nhận qua trang đội: đội trưởng Mike Maignan, đội hình có Pulisic, Modrić, Rabiot, đối thủ là Inter.');
  L.push('- Tên trên eloratings khác tên app: Côte d\'Ivoire = "Ivory Coast", Türkiye = "Turkey". Tên trên fifaindex khác: xem cột "Tên trên nguồn".');
  L.push('');

  // Keep the hand-written performance section between runs.
  const file = path.join(ROOT, 'DATA_REPORT.md');
  let perf = `${MANUAL_START}\n## Performance\n\nChưa đo (Phase 4).\n${MANUAL_END}`;
  if (fs.existsSync(file)) {
    const old = fs.readFileSync(file, 'utf8');
    const i = old.indexOf(MANUAL_START), j = old.indexOf(MANUAL_END);
    if (i >= 0 && j > i) perf = old.slice(i, j + MANUAL_END.length);
  }
  L.push(perf, '');
  fs.writeFileSync(file, L.join('\n'));
  return { quantiles, resolved };
}

const v = (x) => (x == null ? '—' : x);
const kb = (b) => (b == null ? '?' : `${(b / 1024).toFixed(1)} KB`);
function fmtRange(dates) {
  const d = dates.filter(Boolean).sort();
  if (!d.length) return '?';
  return d[0] === d[d.length - 1] ? d[0] : `${d[0]} → ${d[d.length - 1]}`;
}
