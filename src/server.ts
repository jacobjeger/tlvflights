import 'dotenv/config';
import express from 'express';
import path from 'path';
import cron from 'node-cron';
import { initDb, cleanStaleFlights } from './lib/db';
import { runSync } from './lib/sync';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import { apiRoutes } from './routes/api';

const app = express();
const PORT = parseInt(process.env['PORT'] || '8080', 10);

// Resolve paths: in dev (__dirname = src/), in prod (__dirname = dist/)
const srcDir = __dirname.endsWith('dist')
  ? path.join(__dirname, '..', 'src')
  : __dirname;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(srcDir, 'views'));

// Static files
app.use(express.static(path.join(srcDir, 'public')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// Start server
async function start() {
  try {
    await initDb();
    console.log('[server] Database initialized');

    const removed = await cleanStaleFlights();
    if (removed > 0) console.log(`[server] Cleaned ${removed} stale flights`);
  } catch (err) {
    console.error('[server] DB init failed:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });

  // Initial sync after 3 seconds
  setTimeout(async () => {
    console.log('[worker] Running initial sync...');
    try {
      const result = await runSync();
      console.log(`[worker] Initial sync: ${result.total} flights`);
    } catch (err) {
      console.error('[worker] Initial sync failed:', err);
    }
  }, 3000);

  // Recurring sync
  const interval = process.env['SYNC_INTERVAL_MINUTES'] || '60';
  console.log(`[worker] Starting background sync (every ${interval} min)`);
  cron.schedule(`*/${interval} * * * *`, async () => {
    try {
      const result = await runSync();
      console.log(`[worker] Sync: ${result.total} flights, ${result.errors.length} errors`);
    } catch (err) {
      console.error('[worker] Sync failed:', err);
    }
  });
}

start();
