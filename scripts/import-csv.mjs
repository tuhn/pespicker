// Import hand-entered ratings from a CSV (columns: id,name,ovr,att,mid,def; optional: stars).
//
//   npm run import:csv -- ratings_template.csv
//
// Rows with at least one number are merged into src/data/overrides.json (manual numbers always
// win, source "override"). Empty cells are ignored, so an existing value is never wiped by a blank.
// Unknown ids abort the import so typos do not silently disappear.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadTeams, readJson, writeJson } from './lib/paths.mjs';
import { writeReport } from './lib/report.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: npm run import:csv -- <file.csv>'); process.exit(1); }

function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',' || c === ';') { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells.map((s) => s.trim()));
  }
  return rows;
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const header = rows.shift().map((h) => h.toLowerCase());
const idx = (n) => header.indexOf(n);
if (idx('id') < 0) { console.error('CSV needs an "id" column'); process.exit(1); }
const ids = new Set(loadTeams().map((t) => t.id));
const overridesPath = path.join(DATA_DIR, 'overrides.json');
const overrides = readJson(overridesPath);
const today = new Date().toISOString().slice(0, 10);
let n = 0;
const unknown = [];
for (const r of rows) {
  const id = r[idx('id')];
  if (!ids.has(id)) { unknown.push(id); continue; }
  const patch = {};
  for (const k of ['ovr', 'att', 'mid', 'def', 'stars']) {
    if (idx(k) < 0 || r[idx(k)] === '' || r[idx(k)] == null) continue;
    const v = Number(r[idx(k)].replace(',', '.'));
    if (!Number.isFinite(v)) { console.error(`Bad ${k} for ${id}: "${r[idx(k)]}"`); process.exit(1); }
    patch[k] = v;
  }
  if (!Object.keys(patch).length) continue;
  overrides[id] = { ...overrides[id], ...patch, note: `CSV ${path.basename(file)} ${today}` };
  n++;
}
if (unknown.length) { console.error(`Unknown team ids (nothing written): ${unknown.join(', ')}`); process.exit(1); }
writeJson(overridesPath, overrides);
writeReport();
console.log(`Imported ${n} rows into overrides.json. DATA_REPORT.md updated.`);
