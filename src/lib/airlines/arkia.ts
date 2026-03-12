/**
 * Arkia (IZ) API client.
 *
 * BLOCKED by Cloudflare from server-side.
 * Requires a proxy service (ZenRows or ScrapingBee) to bypass.
 * Returns empty array if no proxy is configured.
 *
 * Flow:
 *   1. Fetch promoted destinations
 *   2. For each flight destination, fetch available dates
 *   3. For each date, fetch search results with pricing
 */

import type { Flight } from '../types';
import { fetchWithProxy, isProxyConfigured } from './proxy';

const BASE_URL = 'https://www.arkia.co.il/api/forward/Search';
const CULTURE_ID = '1'; // English

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
  'Referer': 'https://www.arkia.co.il/en/flights',
  'Origin': 'https://www.arkia.co.il',
  'content-type': 'application/json',
  adrum: 'isAjax:true',
};

interface ArkiaDestination {
  CITY_CODEs: string;
  DSTN_NAME: string;
  CATEGORY_SEARCH_TYPES?: string[];
}

interface ArkiaDateResponse {
  OB_DATES?: string[]; // "YYYYMMDD" format
}

interface ArkiaSearchResult {
  FLIGHTS?: ArkiaFlightResult[];
}

interface ArkiaFlightResult {
  FLIGHT_NUMBER?: string;
  DEP_TIME?: string;
  ARV_TIME?: string;
  PRICE?: number;
  CURRENCY_CODE?: string;
  SEATS_AVAILABLE?: number;
}

function buildBookingUrl(cityCode: string, date: string): string {
  return `https://www.arkia.co.il/en/flights-results?fromCity=TLV&toCity=${cityCode}&date=${date}`;
}

/**
 * Step 1: Fetch the list of promoted destinations that have flights.
 */
async function fetchDestinations(): Promise<ArkiaDestination[]> {
  const url = `${BASE_URL}/GetPromotedDestinations?CULTURE_ID=${CULTURE_ID}`;

  const response = await fetchWithProxy(url, {
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    console.error(`[arkia] Destinations API returned ${response.status}`);
    return [];
  }

  const destinations: ArkiaDestination[] = await response.json() as ArkiaDestination[];

  // Only keep destinations that include flights (FL)
  return destinations.filter(
    (d) =>
      d.CATEGORY_SEARCH_TYPES &&
      d.CATEGORY_SEARCH_TYPES.includes('FL'),
  );
}

/**
 * Step 2: Fetch available outbound dates for a specific destination.
 */
async function fetchDatesForDestination(
  cityCode: string,
): Promise<string[]> {
  const url = `${BASE_URL}/GetDates?CULTURE_ID=${CULTURE_ID}`;

  const body = {
    OBJECT: {
      CATEGORY_CODE: 'FL',
      OB_IB: 'OB',
      OB_DEP_CITY: 'TLV',
      OB_ARV_CITY: cityCode,
    },
  };

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(
      `[arkia] GetDates for ${cityCode} returned ${response.status}`,
    );
    return [];
  }

  const json: ArkiaDateResponse = await response.json() as ArkiaDateResponse;
  return json.OB_DATES || [];
}

/**
 * Step 3: Fetch search results (flights + prices) for a destination on a date.
 */
async function fetchSearchResults(
  cityCode: string,
  date: string, // YYYYMMDD
): Promise<ArkiaFlightResult[]> {
  const url = `${BASE_URL}/GetSearchResults?CULTURE_ID=${CULTURE_ID}`;

  const body = {
    OBJECT: {
      OB_DEP_CITY: 'TLV',
      OB_ARV_CITY: cityCode,
      OB_DATE: date,
      ADULTS: 1,
      CHILDREN: 0,
      INFANTS: 0,
      CATEGORY_CODE: 'FL',
      CURRENCY_CODE: 'ILS',
    },
  };

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(
      `[arkia] GetSearchResults for ${cityCode}/${date} returned ${response.status}`,
    );
    return [];
  }

  const json: ArkiaSearchResult = await response.json() as ArkiaSearchResult;
  return json.FLIGHTS || [];
}

/**
 * Format YYYYMMDD to YYYY-MM-DD.
 */
function formatDate(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export async function fetchArkiaFlights(): Promise<Flight[]> {
  const flights: Flight[] = [];
  const now = new Date().toISOString();

  if (!isProxyConfigured()) {
    console.warn(
      '[arkia] No proxy configured – Arkia is blocked by Cloudflare. Skipping.',
    );
    return flights;
  }

  try {
    console.log('[arkia] Fetching destinations via proxy...');

    const destinations = await fetchDestinations();

    if (destinations.length === 0) {
      console.warn('[arkia] No flight destinations found');
      return flights;
    }

    console.log(`[arkia] Found ${destinations.length} flight destinations`);

    // Process destinations sequentially to avoid overwhelming the proxy
    for (const dest of destinations) {
      const cityCode = dest.CITY_CODEs;
      const cityName = dest.DSTN_NAME;

      try {
        const dates = await fetchDatesForDestination(cityCode);

        if (dates.length === 0) {
          continue;
        }

        console.log(
          `[arkia] ${cityCode} (${cityName}): ${dates.length} available dates`,
        );

        // Fetch search results for each date
        for (const date of dates) {
          try {
            const results = await fetchSearchResults(cityCode, date);
            const isoDate = formatDate(date);

            if (results.length === 0) {
              // No detailed results; create a generic availability entry
              const flightId = `IZ_${cityCode}_${isoDate}`;
              flights.push({
                id: flightId,
                flightNumber: '',
                airline: 'IZ',
                airlineName: 'Arkia',
                origin: 'TLV',
                destination: cityCode,
                destinationCity: cityName,
                departureTime: `${isoDate}T00:00:00.000Z`,
                source: 'arkia',
                bookingUrl: buildBookingUrl(cityCode, date),
                lastSeen: now,
              });
              continue;
            }

            for (const r of results) {
              const flightNumber = r.FLIGHT_NUMBER || '';
              const flightId = `IZ_${flightNumber || cityCode}_${isoDate}`;

              flights.push({
                id: flightId,
                flightNumber,
                airline: 'IZ',
                airlineName: 'Arkia',
                origin: 'TLV',
                destination: cityCode,
                destinationCity: cityName,
                departureTime: r.DEP_TIME
                  ? `${isoDate}T${r.DEP_TIME}:00.000Z`
                  : `${isoDate}T00:00:00.000Z`,
                arrivalTime: r.ARV_TIME
                  ? `${isoDate}T${r.ARV_TIME}:00.000Z`
                  : undefined,
                price: r.PRICE,
                currency: r.CURRENCY_CODE || 'ILS',
                seatsAvailable: r.SEATS_AVAILABLE,
                source: 'arkia',
                bookingUrl: buildBookingUrl(cityCode, date),
                lastSeen: now,
              });
            }
          } catch (error) {
            console.error(
              `[arkia] Error fetching results for ${cityCode}/${date}:`,
              error,
            );
          }
        }
      } catch (error) {
        console.error(
          `[arkia] Error processing destination ${cityCode}:`,
          error,
        );
      }
    }

    console.log(`[arkia] Produced ${flights.length} flight records`);
    return flights;
  } catch (error) {
    console.error('[arkia] Failed to fetch flights:', error);
    return flights;
  }
}
