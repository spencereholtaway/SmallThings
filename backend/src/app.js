import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { openStore } from './db.js';
import { entriesRouter } from './routes/entries.js';

export const store = openStore();

const app = express();

app.use(cors());
app.use(express.json());

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Max 60 POST requests per hour.' },
});

const getLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Max 300 GET requests per hour.' },
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Max 30 DELETE requests per hour.' },
});

app.use('/entries', entriesRouter(store, { postLimiter, getLimiter, deleteLimiter }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

export default app;
