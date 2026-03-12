import { Router } from 'express';
import {
  getFlights,
  getLastSync,
  getActiveListings,
  getActiveExitRoutes,
  getAirlineStatuses,
} from '../lib/db';
import { getRegionForDestination, getRegionName, REGIONS } from '../lib/regions';
import { getFlagForAirport } from '../lib/countries';

export const publicRoutes = Router();

publicRoutes.get('/', async (_req, res) => {
  try {
    const flights = await getFlights();
    const lastSync = await getLastSync();
    const listings = await getActiveListings();
    const exitRoutes = await getActiveExitRoutes();
    const airlineStatuses = await getAirlineStatuses();

    // Group flights by date for the chip display
    const dateMap = new Map<string, number>();
    for (const f of flights) {
      const date = f.departureTime.slice(0, 10);
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    }
    const dates = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Unique airlines
    const airlineMap = new Map<string, string>();
    for (const f of flights) {
      airlineMap.set(f.airline, f.airlineName);
    }
    const airlines = Array.from(airlineMap.entries()).map(([code, name]) => ({ code, name }));

    // Unique destinations
    const destCount = new Set(flights.map(f => f.destination)).size;

    res.render('index', {
      flights,
      lastSync,
      listings,
      exitRoutes,
      airlineStatuses,
      dates,
      airlines,
      totalFlights: flights.length,
      totalDestinations: destCount,
      totalAirlines: airlines.length,
      regions: REGIONS.filter(r => r.id !== 'all'),
      getRegionForDestination,
      getRegionName,
      getFlagForAirport,
    });
  } catch (err) {
    console.error('[public] Error rendering index:', err);
    res.status(500).send('Internal server error');
  }
});
