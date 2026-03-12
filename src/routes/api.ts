import { Router } from 'express';
import { getFlights, getLastSync, clearAllFlights } from '../lib/db';
import { runSync } from '../lib/sync';

export const apiRoutes = Router();

apiRoutes.get('/flights', async (req, res) => {
  try {
    const origin = req.query['origin'] as string | undefined;
    const date = req.query['date'] as string | undefined;
    const flights = await getFlights(origin, date);
    const lastSync = await getLastSync();
    res.json({ flights, lastSync, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[api] Error fetching flights:', err);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

apiRoutes.post('/refresh', async (_req, res) => {
  try {
    const result = await runSync();
    res.json({ success: true, flightsStored: result.total, errors: result.errors });
  } catch (err) {
    console.error('[api] Refresh error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

apiRoutes.post('/clear', async (_req, res) => {
  try {
    const removed = await clearAllFlights();
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Clear failed' });
  }
});
