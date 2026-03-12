import { upsertFlights, logSync } from './db';
import { Flight } from './types';

type FetchFunction = () => Promise<Flight[]>;

let syncInProgress = false;

export async function runSync(): Promise<{ total: number; errors: string[] }> {
  if (syncInProgress) {
    console.log('[sync] Already in progress, skipping');
    return { total: 0, errors: ['Sync already in progress'] };
  }

  syncInProgress = true;
  const errors: string[] = [];
  let total = 0;

  try {
    // Dynamic imports to avoid circular dependencies
    const airlines = await import('./airlines/index.js');
    const sources: Array<{ name: string; fetch: FetchFunction }> = [
      { name: 'israir', fetch: airlines.fetchIsrairFlights },
      { name: 'elal', fetch: airlines.fetchElAlFlights },
      { name: 'arkia', fetch: airlines.fetchArkiaFlights },
      { name: 'airhaifa', fetch: airlines.fetchAirHaifaFlights },
    ];

    // Load aggregator sources
    try {
      const aggregators = await import('./aggregators/index.js');
      const env = process.env;
      if (env['AMADEUS_CLIENT_ID']) {
        sources.push({ name: 'amadeus', fetch: aggregators.fetchAmadeusFlights });
      }
      if (env['KIWI_API_KEY']) {
        sources.push({ name: 'kiwi', fetch: aggregators.fetchKiwiFlights });
      }
      // Always load aviationstack — let the module handle its own key check
      sources.push({ name: 'aviationstack', fetch: aggregators.fetchAviationStackFlights });
    } catch (err) {
      console.error('[sync] Aggregator modules not available:', err);
    }

    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const startTime = Date.now();
        try {
          console.log(`[sync] Fetching from ${source.name}...`);
          const flights = await source.fetch();
          const duration = Date.now() - startTime;
          console.log(`[sync] ${source.name}: ${flights.length} flights (${duration}ms)`);
          await logSync(source.name, 'success', flights.length);
          return { name: source.name, flights };
        } catch (error) {
          const duration = Date.now() - startTime;
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[sync] ${source.name} failed (${duration}ms):`, message);
          await logSync(source.name, 'error', 0, message);
          errors.push(`${source.name}: ${message}`);
          return { name: source.name, flights: [] };
        }
      })
    );

    // Collect all flights
    const allFlights: Flight[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.flights.length > 0) {
        allFlights.push(...result.value.flights);
      }
    }

    // Deduplicate: prefer airline-direct sources over aggregators
    const deduped = deduplicateFlights(allFlights);

    if (deduped.length > 0) {
      await upsertFlights(deduped);
    }
    total = deduped.length;

    console.log(`[sync] Complete: ${total} flights stored, ${errors.length} errors`);
  } finally {
    syncInProgress = false;
  }

  return { total, errors };
}

function deduplicateFlights(flights: Flight[]): Flight[] {
  const map = new Map<string, Flight>();

  // Source priority: direct airline > aggregator
  const sourcePriority: Record<string, number> = {
    elal: 10,
    israir: 10,
    arkia: 10,
    airhaifa: 10,
    amadeus: 5,
    kiwi: 5,
    aviationstack: 4,
  };

  for (const flight of flights) {
    // Create a normalized key for deduplication
    const key = `${flight.airline}_${flight.destination}_${flight.departureTime.slice(0, 10)}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, flight);
    } else {
      // Keep the one with higher source priority, or the one with more data
      const existingPriority = sourcePriority[existing.source] || 0;
      const newPriority = sourcePriority[flight.source] || 0;

      if (newPriority > existingPriority) {
        map.set(key, flight);
      } else if (newPriority === existingPriority) {
        // Same priority: keep the one with more data (price, seats)
        const existingScore = (existing.price ? 1 : 0) + (existing.seatsAvailable !== undefined ? 1 : 0);
        const newScore = (flight.price ? 1 : 0) + (flight.seatsAvailable !== undefined ? 1 : 0);
        if (newScore > existingScore) {
          map.set(key, flight);
        }
      }
    }
  }

  return Array.from(map.values());
}

export function isSyncInProgress(): boolean {
  return syncInProgress;
}
