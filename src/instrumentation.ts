export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Start background sync worker
    const cron = await import('node-cron');
    const { runSync } = await import('./lib/sync');

    const interval = process.env.SYNC_INTERVAL_MINUTES || '2';
    console.log(`[worker] Starting background sync (every ${interval} min)`);

    // Clean stale data on startup
    try {
      const { cleanStaleFlights } = await import('./lib/db');
      const removed = cleanStaleFlights();
      if (removed > 0) {
        console.log(`[worker] Cleaned ${removed} stale flights`);
      }
    } catch (error) {
      console.error('[worker] Cleanup failed:', error);
    }

    // Initial sync after 3 seconds
    setTimeout(async () => {
      console.log('[worker] Running initial sync...');
      try {
        const result = await runSync();
        console.log(`[worker] Initial sync: ${result.total} flights`);
      } catch (error) {
        console.error('[worker] Initial sync failed:', error);
      }
    }, 3000);

    // Recurring sync
    cron.default.schedule(`*/${interval} * * * *`, async () => {
      try {
        const result = await runSync();
        console.log(`[worker] Sync: ${result.total} flights, ${result.errors.length} errors`);
      } catch (error) {
        console.error('[worker] Sync failed:', error);
      }
    });
  }
}
