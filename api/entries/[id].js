import { readEntries, writeEntries } from '../_lib/github.js';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!UUID_V4_REGEX.test(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID v4' });
  }

  try {
    const { entries, sha } = await readEntries();
    const filtered = entries.filter((e) => e.id !== id);

    if (filtered.length === entries.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    await writeEntries(filtered, sha);

    return res.status(204).end();
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
