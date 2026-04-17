import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { runMigrations } from './db/migrate';
import authRouter from './routes/auth';
import orgsRouter from './routes/orgs';
import lookupRouter from './routes/lookup';
import schemaRouter from './routes/schema';
import annotationsRouter from './routes/annotations';
import patternsRouter from './routes/patterns';
import exportRouter from './routes/export';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ============================================================
// Middleware
// ============================================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Routes
// ============================================================

app.use('/api/auth', authRouter);
app.use('/api/orgs', orgsRouter);
app.use('/api/lookup', lookupRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/annotations', annotationsRouter);
app.use('/api/patterns', patternsRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// Startup
// ============================================================

async function start(): Promise<void> {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`[server] Unified Profile Explorer API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[server] Startup failed:', err);
    process.exit(1);
  }
}

start();

export default app;
