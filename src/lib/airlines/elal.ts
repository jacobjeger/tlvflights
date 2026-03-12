/**
 * El Al (LY) API client.
 *
 * BLOCKED by Akamai Bot Manager from server-side.
 * Requires a proxy service to bypass.
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

    const destinations = await response.json() as any[];

    for (const dest of destinations) {
      const iata = dest.iata || dest.Iata || dest.IATA || dest.code || dest.Code;
      const city = dest.city || dest.City || dest.name || dest.Name || iata;
      if (iata) {
        cityMap.set(iata, city);
      }
    }
  } catch (error) {
    console.error('[elal] Failed to fetch destinations:', error);
  }

  return cityMap;
}

/**
 * Get a field value from an object trying multiple casing variants.
 */
function getField(obj: any, ...keys: string[]): any {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

/**
 * Parse El Al date string (DD.MM) into ISO date for the current or next year.
 */
function parseElAlDate(dateStr: string): string {
  if (!dateStr) return '';

  // Already ISO format (YYYY-MM-DD or with time)
  if (dateStr.includes('-') && dateStr.length >= 10) {
    return dateStr.slice(0, 10);
  }

  // DD.MM format
  if (dateStr.includes('.')) {
    const [day, month] = dateStr.split('.');
    const now = new Date();
    let year = now.getFullYear();
    const monthNum = parseInt(month, 10);
    if (monthNum < now.getMonth() + 1) {
      year += 1;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or similar
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  return '';
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

    const raw = await flightsResponse.json() as any;

    // Log the top-level response keys for debugging
    console.log('[elal] Response top-level keys:', Object.keys(raw).join(', '));

    // Try to find the flights array in the response
    const flightsArray: any[] =
      raw.flightsFromIsrael ||
      raw.FlightsFromIsrael ||
      raw.flights ||
      raw.Flights ||
      raw.data?.flightsFromIsrael ||
      raw.data?.flights ||
      (Array.isArray(raw) ? raw : null) ||
      [];

    if (!Array.isArray(flightsArray) || flightsArray.length === 0) {
      console.warn('[elal] No flights array found in response');
      console.log('[elal] Response preview:', JSON.stringify(raw).slice(0, 1000));
      return flights;
    }

    // Log first flight object for debugging
    console.log('[elal] Sample flight:', JSON.stringify(flightsArray[0]).slice(0, 800));
    console.log('[elal] Total entries:', flightsArray.length);

    // Try to find a global date range
    const dateRange: string[] =
      raw.dateRange?.dates || raw.DateRange?.Dates || raw.dates || [];
    if (dateRange.length > 0) {
      console.log(`[elal] dateRange: ${dateRange.length} dates, sample: ${dateRange.slice(0, 3).join(', ')}`);
    }

    for (const f of flightsArray) {
      // Extract fields with flexible casing
      const seatCount = getField(f, 'seatCount', 'SeatCount', 'seats', 'Seats', 'availableSeats', 'AvailableSeats');
      const destination = getField(f, 'destination', 'Destination', 'dest', 'Dest', 'dst', 'arrivalStation', 'ArrivalStation') || '';
      const flightNumber = getField(f, 'flightNumber', 'FlightNumber', 'flightNo', 'FlightNo', 'flight', 'Flight') || '';
      const origin = getField(f, 'origin', 'Origin', 'org', 'departureStation', 'DepartureStation') || 'TLV';

      // seatCount === 0 means explicitly sold out — skip
      if (seatCount === 0) {
        continue;
      }

      // Extract date from multiple possible fields
      const rawDate = getField(f, 'date', 'Date', 'departureDate', 'DepartureDate', 'flightDate', 'FlightDate');
      const rawDepTime = getField(f, 'departureTime', 'DepartureTime', 'depTime', 'DepTime', 'std', 'STD');
      const rawArrTime = getField(f, 'arrivalTime', 'ArrivalTime', 'arvTime', 'ArvTime', 'sta', 'STA');

      let date = '';
      if (rawDate) {
        date = parseElAlDate(String(rawDate));
      } else if (rawDepTime && String(rawDepTime).includes('-')) {
        // departureTime might be a full ISO datetime
        date = String(rawDepTime).slice(0, 10);
      }

      // If still no date, skip (can't create valid flight record)
      if (!date) continue;

      // Build departure/arrival times
      let departureTime = `${date}T00:00:00.000Z`;
      if (rawDepTime) {
        const depStr = String(rawDepTime);
        if (depStr.includes('T')) {
          // Already ISO format
          departureTime = depStr;
        } else if (depStr.match(/^\d{2}:\d{2}/)) {
          departureTime = `${date}T${depStr}:00.000Z`;
        }
      }

      let arrivalTime: string | undefined;
      if (rawArrTime) {
        const arrStr = String(rawArrTime);
        if (arrStr.includes('T')) {
          arrivalTime = arrStr;
        } else if (arrStr.match(/^\d{2}:\d{2}/)) {
          arrivalTime = `${date}T${arrStr}:00.000Z`;
        }
      }

      const flightId = `LY_${flightNumber || destination}_${date}`;

      flights.push({
        id: flightId,
        flightNumber,
        airline: 'LY',
        airlineName: 'El Al',
        origin,
        destination,
        destinationCity: cityMap.get(destination) || destination,
        departureTime,
        arrivalTime,
        seatsAvailable: typeof seatCount === 'number' ? seatCount : undefined,
        source: 'elal',
        bookingUrl: buildBookingUrl(destination),
        lastSeen: now,
      });
    }

    const withSeats = flights.filter(f => f.seatsAvailable && f.seatsAvailable > 0).length;
    const noSeatInfo = flights.filter(f => f.seatsAvailable === undefined).length;
    console.log(`[elal] Produced ${flights.length} flights (${withSeats} with seat counts, ${noSeatInfo} without)`);
    return flights;
  } catch (error) {
    console.error('[elal] Failed to fetch flights:', error);
    return flights;
  }
}
