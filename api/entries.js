import { readEntries, writeEntries } from './_lib/github.js';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_CONTENT_LENGTH = 10_000;

function validateEntry(body) {
  const errors = [];
  if (!body.id || !UUID_V4_REGEX.test(body.id))
    errors.push('id must be a valid UUID v4');
  if (typeof body.anon_lat !== 'number' || body.anon_lat < -90 || body.anon_lat > 90)
    errors.push('anon_lat must be a number between -90 and 90');
  if (typeof body.anon_lng !== 'number' || body.anon_lng < -180 || body.anon_lng > 180)
    errors.push('anon_lng must be a number between -180 and 180');
  if (typeof body.content !== 'string' || body.content.length === 0)
    errors.push('content must be a non-empty string');
  else if (body.content.length > MAX_CONTENT_LENGTH)
    errors.push(`content must be at most ${MAX_CONTENT_LENGTH} characters`);
  if (!body.created_at) {
    errors.push('created_at is required');
  } else {
    const ts = Date.parse(body.created_at);
    if (isNaN(ts)) errors.push('created_at must be a valid ISO 8601 timestamp');
    else if (ts > Date.now() + CLOCK_SKEW_MS)
      errors.push('created_at must not be in the future');
  }
  return errors;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { entries } = await readEntries();
      return res.json({ entries, count: entries.length });
    }

    if (req.method === 'POST') {
      const errors = validateEntry(req.body);
      if (errors.length > 0) return res.status(400).json({ errors });

      const { entries, sha } = await readEntries();

      if (entries.some((e) => e.id === req.body.id)) {
        return res.status(409).json({ error: 'Entry with this id already exists' });
      }

      const entry = {
        id: req.body.id,
        anon_lat: req.body.anon_lat,
        anon_lng: req.body.anon_lng,
        content: req.body.content,
        created_at: req.body.created_at,
        received_at: new Date().toISOString(),
      };

      await writeEntries([...entries, entry], sha);

      return res.status(201).json({ id: entry.id, status: 'created' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err.message.includes('409')) {
      return res
        .status(409)
        .json({ error: 'Concurrent write detected. Please try again.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
