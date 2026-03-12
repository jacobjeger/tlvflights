/**
 * El Al (LY) API client.
 *
 * BLOCKED by Akamai Bot Manager from server-side.
 * Requires a proxy service (ZenRows or ScrapingBee) to bypass.
 * Returns empty array if no proxy is configured.
 */

import type { Flight } from '../types';
import { fetchWithProxy, isProxyConfigured } from './proxy';

const FLIGHTS_URL =
  'https://www.elal.com/api/SeatAvailability/lang/eng/flights';
const DESTINATIONS_URL =
  'https://www.elal.com/api/destinations/lang/eng/direct';

const COMMON_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.elal.com/eng/seat-availability?d=0',
};

interface ElAlFlight {
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  destination?: string;
  origin?: string;
  seatCount?: number;
  date?: string;
}

interface ElAlFlightsResponse {
  dateRange?: {
    dates?: string[];
  };
  flightsFromIsrael?: ElAlFlight[];
}

interface ElAlDestination {
  iata?: string;
  name?: string;
  city?: string;
  country?: string;
}

function buildBookingUrl(destination: string): string {
  return (
    `https://booking.elal.com/ELAL/en-US/booking/search` +
    `?ADT=1&CHD=0&INF=0&org=TLV&dst=${destination}&tripType=OW&cabin=Y`
  );
}

/**
 * Fetch destination metadata from El Al. Returns a map of IATA -> city name.
 */
async function fetchDestinations(): Promise<Map<string, string>> {
  const cityMap = new Map<string, string>();

  try {
    const response = await fetchWithProxy(DESTINATIONS_URL, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      console.error(`[elal] Destinations API returned ${response.status}`);
      return cityMap;
    }

    const destinations: ElAlDestination[] = await response.json() as ElAlDestination[];

    for (const dest of destinations) {
      if (dest.iata) {
        cityMap.set(dest.iata, dest.city || dest.name || dest.iata);
      }
    }
  } catch (error) {
    console.error('[elal] Failed to fetch destinations:', error);
  }

  return cityMap;
}

/**
 * Parse El Al date string (DD.MM) into ISO date for the current or next year.
 */
function parseElAlDate(dateStr: string): string {
  const [day, month] = dateStr.split('.');
  const now = new Date();
  let year = now.getFullYear();

  // If the month is before the current month, assume next year
  const monthNum = parseInt(month, 10);
  if (monthNum < now.getMonth() + 1) {
    year += 1;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export async function fetchElAlFlights(): Promise<Flight[]> {
  const flights: Flight[] = [];
  const now = new Date().toISOString();

  if (!isProxyConfigured()) {
    console.warn(
      '[elal] No proxy configured – El Al is blocked by Akamai. Skipping.',
    );
    return flights;
  }

  try {
    console.log('[elal] Fetching flights via proxy...');

    // Fetch destinations and flights in parallel
    const [cityMap, flightsResponse] = await Promise.all([
      fetchDestinations(),
      fetchWithProxy(FLIGHTS_URL, { headers: COMMON_HEADERS }),
    ]);

    if (!flightsResponse.ok) {
      console.error(
        `[elal] Flights API returned ${flightsResponse.status}: ${flightsResponse.statusText}`,
      );
      return flights;
    }

    const json: ElAlFlightsResponse = await flightsResponse.json() as ElAlFlightsResponse;

    if (!json.flightsFromIsrael || json.flightsFromIsrael.length === 0) {
      console.warn('[elal] No flights found in response');
      return flights;
    }

    const total = json.flightsFromIsrael.length;
    const soldOut = json.flightsFromIsrael.filter(f => f.seatCount === 0).length;
    const withSeats = json.flightsFromIsrael.filter(f => f.seatCount && f.seatCount > 0).length;
    const noSeatInfo = json.flightsFromIsrael.filter(f => f.seatCount === undefined || f.seatCount === null).length;
    console.log(
      `[elal] Received ${total} entries: ${withSeats} with seats, ${soldOut} sold out, ${noSeatInfo} no seat info`,
    );

    for (const f of json.flightsFromIsrael) {
      // seatCount === 0 means explicitly sold out — skip those
      // seatCount undefined/null means listed on seat availability page = available
      if (f.seatCount === 0) {
        continue;
      }

      const destination = f.destination || '';
      const flightNumber = f.flightNumber || '';
      const date = f.date ? parseElAlDate(f.date) : '';

      // Skip flights with no valid date — they produce invalid timestamps
      if (!date) continue;

      const flightId = `LY_${flightNumber || destination}_${date}`;

      flights.push({
        id: flightId,
        flightNumber,
        airline: 'LY',
        airlineName: 'El Al',
        origin: f.origin || 'TLV',
        destination,
        destinationCity: cityMap.get(destination) || destination,
        departureTime: f.departureTime
          ? `${date}T${f.departureTime}:00.000Z`
          : `${date}T00:00:00.000Z`,
        arrivalTime: f.arrivalTime
          ? `${date}T${f.arrivalTime}:00.000Z`
          : undefined,
        seatsAvailable: f.seatCount,
        source: 'elal',
        bookingUrl: buildBookingUrl(destination),
        lastSeen: now,
      });
    }

    console.log(`[elal] Produced ${flights.length} available flight records`);
    return flights;
  } catch (error) {
    console.error('[elal] Failed to fetch flights:', error);
    return flights;
  }
}
