import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

export function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      anon_lat REAL NOT NULL,
      anon_lng REAL NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
  `);

  return db;
}

export function openDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  return createDb(join(DATA_DIR, 'entries.db'));
}

export function insertEntry(db, entry) {
  const stmt = db.prepare(`
    INSERT INTO entries (id, anon_lat, anon_lng, content, created_at, received_at)
    VALUES (@id, @anon_lat, @anon_lng, @content, @created_at, @received_at)
  `);
  return stmt.run(entry);
}

export function getEntries(db, { since, bbox }) {
  let sql = 'SELECT id, anon_lat, anon_lng, content, created_at FROM entries WHERE created_at > ?';
  const params = [since];

  if (bbox) {
    sql += ' AND anon_lat >= ? AND anon_lng >= ? AND anon_lat <= ? AND anon_lng <= ?';
    params.push(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng);
  }

  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}

export function deleteEntry(db, id) {
  const result = db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  return result.changes > 0;
}

export function cleanupOldEntries(db) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM entries WHERE created_at < ?').run(cutoff);
  return result.changes;
}
