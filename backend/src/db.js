import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const LOCAL_FILE = join(DATA_DIR, 'entries.json');

// --- Shared ---

function filterEntries(entries, { since, bbox }) {
  return entries
    .filter(e => e.created_at > since)
    .filter(e => {
      if (!bbox) return true;
      return e.anon_lat >= bbox.minLat && e.anon_lat <= bbox.maxLat &&
             e.anon_lng >= bbox.minLng && e.anon_lng <= bbox.maxLng;
    })
    .map(({ received_at, ...rest }) => rest)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function duplicateError() {
  const err = new Error('Entry with this id already exists');
  err.code = 'DUPLICATE_ID';
  return err;
}

// --- GitHub store ---

function createGithubStore() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const filePath = process.env.GITHUB_FILE_PATH || 'entries.json';
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  async function load() {
    const res = await fetch(url, { headers });
    if (res.status === 404) return { entries: [], sha: null };
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    return {
      entries: JSON.parse(Buffer.from(data.content, 'base64').toString()),
      sha: data.sha,
    };
  }

  async function save(entries, sha) {
    const body = {
      message: 'update entries',
      content: Buffer.from(JSON.stringify(entries, null, 2)).toString('base64'),
      ...(sha && { sha }),
    };
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  }

  return {
    async insertEntry(entry) {
      const { entries, sha } = await load();
      if (entries.some(e => e.id === entry.id)) throw duplicateError();
      entries.push(entry);
      await save(entries, sha);
    },
    async getEntries(opts) {
      const { entries } = await load();
      return filterEntries(entries, opts);
    },
    async deleteEntry(id) {
      const { entries, sha } = await load();
      const idx = entries.findIndex(e => e.id === id);
      if (idx === -1) return false;
      entries.splice(idx, 1);
      await save(entries, sha);
      return true;
    },
  };
}

// --- Local file store ---

function createLocalStore() {
  function load() {
    mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(LOCAL_FILE)) writeFileSync(LOCAL_FILE, '[]', 'utf8');
    return JSON.parse(readFileSync(LOCAL_FILE, 'utf8'));
  }

  function save(entries) {
    writeFileSync(LOCAL_FILE, JSON.stringify(entries, null, 2), 'utf8');
  }

  return {
    async insertEntry(entry) {
      const entries = load();
      if (entries.some(e => e.id === entry.id)) throw duplicateError();
      entries.push(entry);
      save(entries);
    },
    async getEntries(opts) {
      return filterEntries(load(), opts);
    },
    async deleteEntry(id) {
      const entries = load();
      const idx = entries.findIndex(e => e.id === id);
      if (idx === -1) return false;
      entries.splice(idx, 1);
      save(entries);
      return true;
    },
  };
}

// --- In-memory store (for tests) ---

export function createStore(initial = []) {
  const store = {
    entries: [...initial],
    async insertEntry(entry) {
      if (store.entries.some(e => e.id === entry.id)) throw duplicateError();
      store.entries.push(entry);
    },
    async getEntries(opts) {
      return filterEntries(store.entries, opts);
    },
    async deleteEntry(id) {
      const idx = store.entries.findIndex(e => e.id === id);
      if (idx === -1) return false;
      store.entries.splice(idx, 1);
      return true;
    },
  };
  return store;
}

// --- Factory ---

export function openStore() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
    return createGithubStore();
  }
  return createLocalStore();
}
