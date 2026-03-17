import { Router } from 'express';
import { validateEntry, validateUuid, parseBbox } from '../validation.js';

export function entriesRouter(store, { postLimiter, getLimiter, deleteLimiter }) {
  const router = Router();

  router.post('/', postLimiter, async (req, res, next) => {
    const errors = validateEntry(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const entry = {
      id: req.body.id,
      anon_lat: req.body.anon_lat,
      anon_lng: req.body.anon_lng,
      content: req.body.content,
      created_at: req.body.created_at,
      received_at: new Date().toISOString(),
    };

    try {
      await store.insertEntry(entry);
    } catch (err) {
      if (err.code === 'DUPLICATE_ID') {
        return res.status(409).json({ error: 'Entry with this id already exists' });
      }
      return next(err);
    }

    res.status(201).json({ id: entry.id, status: 'created' });
  });

  router.get('/', getLimiter, async (req, res, next) => {
    const since = req.query.since || new Date(0).toISOString();

    if (req.query.since && isNaN(Date.parse(req.query.since))) {
      return res.status(400).json({ error: 'since must be a valid ISO 8601 timestamp' });
    }

    let bbox = null;
    if (req.query.bbox) {
      bbox = parseBbox(req.query.bbox);
      if (!bbox) {
        return res.status(400).json({ error: 'bbox must be min_lat,min_lng,max_lat,max_lng with valid ranges' });
      }
    }

    try {
      const entries = await store.getEntries({ since, bbox });
      res.json({ entries, count: entries.length, since });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', deleteLimiter, async (req, res, next) => {
    if (!validateUuid(req.params.id)) {
      return res.status(400).json({ error: 'id must be a valid UUID v4' });
    }

    try {
      const deleted = await store.deleteEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
