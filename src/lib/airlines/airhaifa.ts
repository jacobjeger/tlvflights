/**
 * Air Haifa (E2) API client.
 *
 * BLOCKED by Imperva/Incapsula from server-side.
 * Requires a proxy service (ZenRows or ScrapingBee) to bypass.
 * Returns empty array if no proxy is configured.
 *
 * Complex multi-step flow:
 *   1. Create a session via sessionHandler.php
 *   2. Validate session and get CSRF token from x-csrf-token header
 *   3. Fetch destinations with CSRF token
 *   4. For each destination, fetch calendar availability
 *   5. For each available date, trigger a search
 *   6. Pull flight results from flightList.php
 */

import type { Flight } from '../types';
import { fetchWithProxy, isProxyConfigured } from './proxy';

const BASE_URL = 'https://airhaifa.com';

interface AirHaifaDestination {
  iata?: string;
  code?: string;
  name?: string;
  city?: string;
}

interface AirHaifaCalendarDay {
  date?: string; // DD/MM/YYYY or YYYY-MM-DD
  available?: boolean;
  price?: number;
}

interface AirHaifaFlightResult {
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  price?: number;
  currency?: string;
  seatsAvailable?: number;
}

/**
 * Step 1: Initialize session.
 */
async function createSession(): Promise<void> {
  const url = `${BASE_URL}/controllers/general/sessionHandler.php`;

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: `${BASE_URL}/`,
    },
    body: JSON.stringify({
      container: 'cookies',
      data: 'get',
      action: 'add',
    }),
  });

  if (!response.ok) {
    throw new Error(`Session init failed with status ${response.status}`);
  }

  // We don't need the body; the session cookie is set server-side.
  await response.text();
}

/**
 * Step 2: Validate session and extract CSRF token from response header.
 */
async function getCsrfToken(): Promise<string> {
  const url = `${BASE_URL}/controllers/bookingProcess/validateSession.php`;

  const response = await fetchWithProxy(url, {
    headers: {
      Referer: `${BASE_URL}/`,
    },
  });

  if (!response.ok) {
    throw new Error(`Session validation failed with status ${response.status}`);
  }

  const csrfToken = response.headers.get('x-csrf-token');
  if (!csrfToken) {
    // Some proxy services may normalize headers to lowercase
    const altToken = response.headers.get('X-CSRF-Token');
    if (altToken) return altToken;
    throw new Error('No CSRF token found in response headers');
  }

  return csrfToken;
}

/**
 * Step 3: Fetch all destinations.
 */
async function fetchDestinations(
  csrfToken: string,
): Promise<AirHaifaDestination[]> {
  const url = `${BASE_URL}/controllers/general/destinations.php`;

  const response = await fetchWithProxy(url, {
    headers: {
      'x-csrf-token': csrfToken,
      Referer: `${BASE_URL}/`,
    },
  });

  if (!response.ok) {
    console.error(`[airhaifa] Destinations returned ${response.status}`);
    return [];
  }

  const data = await response.json();
  // Normalize: API may return an object with a destinations key or an array directly
  if (Array.isArray(data)) return data;
  if (data.destinations && Array.isArray(data.destinations)) return data.destinations;
  return [];
}

/**
 * Step 4: Fetch calendar availability for a destination.
 */
async function fetchCalendar(
  csrfToken: string,
  destinationIata: string,
): Promise<AirHaifaCalendarDay[]> {
  const params = new URLSearchParams({
    type: 'OW',
    adults: '1',
    children: '0',
    infants: '0',
    fromDst: 'TLV',
    toDst: destinationIata,
  });

  const url = `${BASE_URL}/controllers/bookingProcess/searchCalendar.php?${params}`;

  const response = await fetchWithProxy(url, {
    headers: {
      'x-csrf-token': csrfToken,
      Referer: `${BASE_URL}/`,
    },
  });

  if (!response.ok) {
    console.error(
      `[airhaifa] Calendar for ${destinationIata} returned ${response.status}`,
    );
    return [];
  }

  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (data.dates && Array.isArray(data.dates)) return data.dates;
  if (data.calendar && Array.isArray(data.calendar)) return data.calendar;
  return [];
}

/**
 * Step 5 + 6: Trigger search and pull flight results.
 */
async function fetchFlightsForDate(
  csrfToken: string,
  destinationIata: string,
  date: string, // DD/MM/YYYY
): Promise<AirHaifaFlightResult[]> {
  // Step 5: Trigger search
  const searchParams = new URLSearchParams({
    tripType: 'OW',
    fromDst: 'TLV',
    toDst: destinationIata,
    start: date,
    adults: '1',
    children: '0',
    infants: '0',
  });

  const searchUrl = `${BASE_URL}/controllers/general/search.php?${searchParams}`;

  const searchResponse = await fetchWithProxy(searchUrl, {
    headers: {
      'x-csrf-token': csrfToken,
      Referer: `${BASE_URL}/`,
    },
  });

  if (!searchResponse.ok) {
    console.error(
      `[airhaifa] Search for ${destinationIata}/${date} returned ${searchResponse.status}`,
    );
    return [];
  }

  // Wait briefly for search to process
  await searchResponse.text();

  // Step 6: Pull flight list
  const listUrl = `${BASE_URL}/controllers/flightresults/flightList.php?action=flightsPull`;

  const listResponse = await fetchWithProxy(listUrl, {
    headers: {
      'x-csrf-token': csrfToken,
      Referer: `${BASE_URL}/`,
    },
  });

  if (!listResponse.ok) {
    console.error(
      `[airhaifa] FlightList for ${destinationIata}/${date} returned ${listResponse.status}`,
    );
    return [];
  }

  const data = await listResponse.json();
  if (Array.isArray(data)) return data;
  if (data.flights && Array.isArray(data.flights)) return data.flights;
  return [];
}

/**
 * Parse a date from DD/MM/YYYY to YYYY-MM-DD.
 */
function parseDateDMY(date: string): string {
  const parts = date.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  // Already in YYYY-MM-DD
  return date;
}

function buildBookingUrl(destinationIata: string, isoDate: string): string {
  return `${BASE_URL}/flight-results/TLV-${destinationIata}/${isoDate}/NA/1/0/0`;
}

export async function fetchAirHaifaFlights(): Promise<Flight[]> {
  const flights: Flight[] = [];
  const now = new Date().toISOString();

  if (!isProxyConfigured()) {
    console.warn(
      '[airhaifa] No proxy configured – Air Haifa is blocked by Imperva. Skipping.',
    );
    return flights;
  }

  try {
    console.log('[airhaifa] Initializing session via proxy...');

    // Step 1: Create session
    await createSession();

    // Step 2: Get CSRF token
    const csrfToken = await getCsrfToken();
    console.log('[airhaifa] Got CSRF token');

    // Step 3: Fetch destinations
    const destinations = await fetchDestinations(csrfToken);

    if (destinations.length === 0) {
      console.warn('[airhaifa] No destinations found');
      return flights;
    }

    console.log(`[airhaifa] Found ${destinations.length} destinations`);

    // Process each destination
    for (const dest of destinations) {
      const iata = dest.iata || dest.code || '';
      const cityName = dest.city || dest.name || iata;

      if (!iata) continue;

      try {
        // Step 4: Fetch calendar
        const calendar = await fetchCalendar(csrfToken, iata);
        const availableDates = calendar.filter(
          (day) => day.available !== false && day.date,
        );

        if (availableDates.length === 0) {
          continue;
        }

        console.log(
          `[airhaifa] ${iata} (${cityName}): ${availableDates.length} available dates`,
        );

        for (const day of availableDates) {
          const rawDate = day.date!;
          const isoDate = parseDateDMY(rawDate);

          try {
            // Steps 5 + 6: Fetch flight details
            const flightResults = await fetchFlightsForDate(
              csrfToken,
              iata,
              rawDate,
            );

            if (flightResults.length === 0) {
              // Create a generic availability entry from calendar data
              const flightId = `E2_${iata}_${isoDate}`;
              flights.push({
                id: flightId,
                flightNumber: '',
                airline: 'E2',
                airlineName: 'Air Haifa',
                origin: 'TLV',
                destination: iata,
                destinationCity: cityName,
                departureTime: `${isoDate}T00:00:00.000Z`,
                price: day.price,
                currency: day.price ? 'ILS' : undefined,
                source: 'airhaifa',
                bookingUrl: buildBookingUrl(iata, isoDate),
                lastSeen: now,
              });
              continue;
            }

            for (const r of flightResults) {
              const flightNumber = r.flightNumber || '';
              const flightId = `E2_${flightNumber || iata}_${isoDate}`;

              flights.push({
                id: flightId,
                flightNumber,
                airline: 'E2',
                airlineName: 'Air Haifa',
                origin: 'TLV',
                destination: iata,
                destinationCity: cityName,
                departureTime: r.departureTime
                  ? `${isoDate}T${r.departureTime}:00.000Z`
                  : `${isoDate}T00:00:00.000Z`,
                arrivalTime: r.arrivalTime
                  ? `${isoDate}T${r.arrivalTime}:00.000Z`
                  : undefined,
                price: r.price,
                currency: r.currency || 'ILS',
                seatsAvailable: r.seatsAvailable,
                source: 'airhaifa',
                bookingUrl: buildBookingUrl(iata, isoDate),
                lastSeen: now,
              });
            }
          } catch (error) {
            console.error(
              `[airhaifa] Error fetching flights for ${iata}/${rawDate}:`,
              error,
            );
          }
        }
      } catch (error) {
        console.error(
          `[airhaifa] Error processing destination ${iata}:`,
          error,
        );
      }
    }

    console.log(`[airhaifa] Produced ${flights.length} flight records`);
    return flights;
  } catch (error) {
    console.error('[airhaifa] Failed to fetch flights:', error);
    return flights;
  }
}
