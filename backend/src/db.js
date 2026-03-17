import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const FILE_PATH = join(DATA_DIR, 'entries.json');

export function createStore(entries = []) {
  return { entries, _file: null };
}

export function openStore() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE_PATH)) {
    writeFileSync(FILE_PATH, '[]', 'utf8');
  }
  const entries = JSON.parse(readFileSync(FILE_PATH, 'utf8'));
  return { entries, _file: FILE_PATH };
}

function save(store) {
  if (store._file) {
    writeFileSync(store._file, JSON.stringify(store.entries, null, 2), 'utf8');
  }
}

export function insertEntry(store, entry) {
  if (store.entries.some(e => e.id === entry.id)) {
    const err = new Error('Entry with this id already exists');
    err.code = 'DUPLICATE_ID';
    throw err;
  }
  store.entries.push(entry);
  save(store);
}

export function getEntries(store, { since, bbox }) {
  return store.entries
    .filter(e => e.created_at > since)
    .filter(e => {
      if (!bbox) return true;
      return e.anon_lat >= bbox.minLat && e.anon_lat <= bbox.maxLat &&
             e.anon_lng >= bbox.minLng && e.anon_lng <= bbox.maxLng;
    })
    .map(({ received_at, ...rest }) => rest)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function deleteEntry(store, id) {
  const idx = store.entries.findIndex(e => e.id === id);
  if (idx === -1) return false;
  store.entries.splice(idx, 1);
  save(store);
  return true;
}
