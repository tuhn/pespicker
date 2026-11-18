import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const CACHE_DIR = path.join(ROOT, '.cache');
export const DATA_DIR = path.join(ROOT, 'src', 'data');
export const ASSETS_DIR = path.join(ROOT, 'src', 'assets');

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
export const loadTeams = () => readJson(path.join(DATA_DIR, 'teams.json'));
