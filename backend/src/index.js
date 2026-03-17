import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDb, cleanupOldEntries } from './db.js';
import { entriesRouter } from './routes/entries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const db = openDb();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
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

// Routes
app.use('/entries', entriesRouter(db, { postLimiter, getLimiter, deleteLimiter }));

// Serve frontend static files
app.use(express.static(join(__dirname, '..', '..', 'frontend', 'dist')));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// SPA fallback — serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
});

// Cleanup old entries on startup and every 24 hours
const runCleanup = () => {
  const deleted = cleanupOldEntries(db);
  if (deleted > 0) console.log(`Cleaned up ${deleted} old entries`);
};
runCleanup();
setInterval(runCleanup, 24 * 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export { app, db };
