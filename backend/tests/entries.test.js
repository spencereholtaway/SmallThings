import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/db.js';
import { validateEntry, validateUuid, parseBbox } from '../src/validation.js';

// --- Validation unit tests ---

describe('validateEntry', () => {
  const validEntry = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    anon_lat: 37.7891,
    anon_lng: -122.4194,
    content: '{"type":"observation","note":"Saw a hawk"}',
    created_at: new Date().toISOString(),
  };

  it('accepts a valid entry', () => {
    assert.deepEqual(validateEntry(validEntry), []);
  });

  it('rejects invalid UUID', () => {
    const errors = validateEntry({ ...validEntry, id: 'not-a-uuid' });
    assert.ok(errors.some(e => e.includes('UUID')));
  });

  it('rejects non-v4 UUID', () => {
    const errors = validateEntry({ ...validEntry, id: '550e8400-e29b-31d4-a716-446655440000' });
    assert.ok(errors.some(e => e.includes('UUID')));
  });

  it('rejects lat out of range', () => {
    assert.ok(validateEntry({ ...validEntry, anon_lat: 91 }).length > 0);
    assert.ok(validateEntry({ ...validEntry, anon_lat: -91 }).length > 0);
  });

  it('rejects lng out of range', () => {
    assert.ok(validateEntry({ ...validEntry, anon_lng: 181 }).length > 0);
    assert.ok(validateEntry({ ...validEntry, anon_lng: -181 }).length > 0);
  });

  it('rejects empty content', () => {
    assert.ok(validateEntry({ ...validEntry, content: '' }).length > 0);
  });

  it('rejects content over 10,000 chars', () => {
    assert.ok(validateEntry({ ...validEntry, content: 'a'.repeat(10001) }).length > 0);
  });

  it('rejects invalid timestamp', () => {
    assert.ok(validateEntry({ ...validEntry, created_at: 'not-a-date' }).length > 0);
  });

  it('rejects future timestamp beyond 5 min', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    assert.ok(validateEntry({ ...validEntry, created_at: future }).length > 0);
  });

  it('allows timestamp up to 5 min in the future', () => {
    const nearFuture = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    assert.deepEqual(validateEntry({ ...validEntry, created_at: nearFuture }), []);
  });
});

describe('validateUuid', () => {
  it('accepts valid v4 UUID', () => {
    assert.ok(validateUuid('550e8400-e29b-41d4-a716-446655440000'));
  });
  it('rejects garbage', () => {
    assert.ok(!validateUuid('hello'));
  });
});

describe('parseBbox', () => {
  it('parses valid bbox', () => {
    assert.deepEqual(parseBbox('37,-123,38,-122'), { minLat: 37, minLng: -123, maxLat: 38, maxLng: -122 });
  });
  it('returns null for invalid', () => {
    assert.equal(parseBbox('a,b,c,d'), null);
    assert.equal(parseBbox('1,2'), null);
    assert.equal(parseBbox(null), null);
  });
  it('rejects inverted ranges', () => {
    assert.equal(parseBbox('38,-122,37,-123'), null);
  });
});

// --- Store integration tests ---

describe('Store', () => {
  let store;

  before(() => {
    store = createStore();
  });

  beforeEach(() => {
    store.entries = [];
  });

  const makeEntry = (overrides = {}) => ({
    id: crypto.randomUUID(),
    anon_lat: 37.7891,
    anon_lng: -122.4194,
    content: '{"note":"test"}',
    created_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
    ...overrides,
  });

  it('inserts and retrieves an entry', async () => {
    const entry = makeEntry();
    await store.insertEntry(entry);

    const results = await store.getEntries({ since: new Date(Date.now() - 60000).toISOString() });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, entry.id);
    assert.equal(results[0].anon_lat, entry.anon_lat);
    // received_at should NOT be in the result
    assert.equal(results[0].received_at, undefined);
  });

  it('rejects duplicate id', async () => {
    const entry = makeEntry();
    await store.insertEntry(entry);
    await assert.rejects(() => store.insertEntry(entry), /already exists/);
  });

  it('filters by since', async () => {
    const old = makeEntry({ created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() });
    const recent = makeEntry();
    await store.insertEntry(old);
    await store.insertEntry(recent);

    const results = await store.getEntries({ since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, recent.id);
  });

  it('filters by bbox', async () => {
    const inside = makeEntry({ anon_lat: 37.5, anon_lng: -122.5 });
    const outside = makeEntry({ anon_lat: 40.0, anon_lng: -120.0 });
    await store.insertEntry(inside);
    await store.insertEntry(outside);

    const results = await store.getEntries({
      since: new Date(Date.now() - 60000).toISOString(),
      bbox: { minLat: 37, minLng: -123, maxLat: 38, maxLng: -122 },
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, inside.id);
  });

  it('deletes an entry', async () => {
    const entry = makeEntry();
    await store.insertEntry(entry);
    assert.ok(await store.deleteEntry(entry.id));
    assert.ok(!await store.deleteEntry(entry.id)); // already gone
  });
});
