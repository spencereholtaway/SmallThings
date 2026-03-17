import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import app from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Serve frontend static files and SPA fallback (local dev only)
app.use(express.static(join(__dirname, '..', '..', 'frontend', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
});

process.on('SIGINT', () => process.exit(0));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
