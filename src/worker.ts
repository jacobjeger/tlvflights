import cron from 'node-cron';
import { runSync } from './lib/sync';

const AIRLINE_INTERVAL = process.env['SYNC_INTERVAL_MINUTES'] || '2';

console.log(`[worker] Starting background sync worker (every ${AIRLINE_INTERVAL} minutes)`);

// Run initial sync on startup
setTimeout(async () => {
  console.log('[worker] Running initial sync...');
  try {
    const result = await runSync();
    console.log(`[worker] Initial sync complete: ${result.total} flights`);
  } catch (error) {
    console.error('[worker] Initial sync failed:', error);
  }
}, 2000);

// Schedule recurring syncs
cron.schedule(`*/${AIRLINE_INTERVAL} * * * *`, async () => {
  console.log('[worker] Scheduled sync starting...');
  try {
    const result = await runSync();
    console.log(`[worker] Scheduled sync complete: ${result.total} flights, ${result.errors.length} errors`);
  } catch (error) {
    console.error('[worker] Scheduled sync failed:', error);
  }
});

console.log('[worker] Background sync worker ready');
