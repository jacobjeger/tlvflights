/**
 * Israir (6H) API client.
 *
 * Sometimes works directly, sometimes blocked by Imperva/Incapsula.
 * Fetches all outbound one-way flights from TLV with availability.
 * Will need proxy service for reliable access.
 */

import crypto from 'crypto';
import type { Flight } from '../types';

const API_URL = 'https://www.israirairlines.com/api/engine';

// Known Israir destination city names by IATA code.
const CITY_NAMES: Record<string, string> = {
  ATH: 'Athens', BUD: 'Budapest', PFO: 'Paphos', LCA: 'Larnaca',
  RHO: 'Rhodes', HER: 'Heraklion', CFU: 'Corfu', JTR: 'Santorini',
  PRG: 'Prague', BTS: 'Bratislava', MRS: 'Marseille', TBS: 'Tbilisi',
  BUS: 'Batumi', VAR: 'Varna', BOJ: 'Burgas', DEB: 'Debrecen',
  SKG: 'Thessaloniki', JMK: 'Mykonos', ZTH: 'Zakynthos', KGS: 'Kos',
  MJT: 'Mytilene', AOK: 'Karpathos', EFL: 'Kefalonia', JSI: 'Skiathos',
  SMI: 'Samos', SSH: 'Sharm el-Sheikh', BLQ: 'Bologna', VLC: 'Valencia',
  BUH: 'Bucharest', LON: 'London', GNB: 'Grenoble', DXB: 'Dubai',
  MAD: 'Madrid', MIL: 'Milan', RVN: 'Rovaniemi', PAR: 'Paris',
  TIV: 'Tivat', LJU: 'Ljubljana', VNO: 'Vilnius', CGN: 'Cologne',
  SOF: 'Sofia', TIA: 'Tirana', BER: 'Berlin', SZG: 'Salzburg',
  ZNZ: 'Zanzibar', BGO: 'Bergen', OSL: 'Oslo', AGP: 'Malaga',
  BAK: 'Baku', DUS: 'Dusseldorf', BRI: 'Bari', NAP: 'Naples',
  CTA: 'Catania', VIE: 'Vienna', FRA: 'Frankfurt', VRN: 'Verona',
  BSL: 'Basel', STR: 'Stuttgart', ROM: 'Rome',
};

interface IsrairResponse {
  status: string;
  data?: {
    destLocations?: string[];
    complexDestLocations?: Array<{
      cityCode: string;
      ltravelId?: string;
    }>;
    calendarMap?: Record<string, string[]>;
  };
}

function getCityName(iata: string): string {
  return CITY_NAMES[iata] || iata;
}

function buildBookingUrl(destination: string, date: string): string {
  return (
    `https://www.israirairlines.com/flight-search` +
    `?from=TLV&to=${destination}&startDate=${date}&packageType=ONEWAY_FLIGHT&adults=1`
  );
}

export async function fetchIsrairFlights(): Promise<Flight[]> {
  const flights: Flight[] = [];
  const now = new Date().toISOString();

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const sessionKey = `${crypto.randomUUID()}-${Date.now()}`;

    const params = new URLSearchParams({
      siteId: 'israirairlines2024',
      from: 'TLV',
      to: 'ALL',
      packageType: 'ONEWAY_FLIGHT',
      startDate: today,
      returnDate: 'null',
      daysForward: '365',
      daysReturn: '365',
      noCache: 'true',
    });

    const url = `${API_URL}?${params.toString()}`;

    console.log('[israir] Fetching flights from Israir API...');

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.israirairlines.com',
        Referer: 'https://www.israirairlines.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ sessionKey }),
      signal: controller.signal,
    });
    clearTimeout(fetchTimeout);

    if (!response.ok) {
      console.error(`[israir] API returned ${response.status}: ${response.statusText}`);
      return flights;
    }

    const text = await response.text();

    // Check for anti-bot challenge page
    if (text.includes('_Incapsula_Resource') || text.includes('<!DOCTYPE html>') || text.startsWith('<html')) {
      console.warn('[israir] Blocked by Imperva/Incapsula. Proxy may be needed.');
      return flights;
    }

    const json: IsrairResponse = JSON.parse(text);

    if (json.status !== 'Accepted' || !json.data) {
      console.error('[israir] Unexpected response status:', json.status);
      return flights;
    }

    const { destLocations, calendarMap } = json.data;

    if (!destLocations || !calendarMap) {
      console.warn('[israir] No destinations or calendar data in response');
      return flights;
    }

    console.log(
      `[israir] Found ${destLocations.length} destinations, ` +
        `${Object.keys(calendarMap).length} date entries`,
    );

    // Build a lookup from complexDestLocations if available
    const destMeta = new Map<string, { ltravelId?: string }>();
    if (json.data.complexDestLocations) {
      for (const dest of json.data.complexDestLocations) {
        destMeta.set(dest.cityCode, { ltravelId: dest.ltravelId });
      }
    }

    // Limit to next 14 days to keep data manageable
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14);
    const maxDateStr = maxDate.toISOString().slice(0, 10);

    // Collect unique available dates from the calendarMap (limited to 14 days)
    const availableDates = new Set<string>();
    for (const date of Object.keys(calendarMap)) {
      if (date <= maxDateStr) {
        availableDates.add(date);
      }
    }

    // Create a flight entry for each destination x available date
    for (const destination of destLocations) {
      const cityName = getCityName(destination);

      for (const date of Array.from(availableDates)) {
        const flightId = `6H_${destination}_${date}`;

        flights.push({
          id: flightId,
          flightNumber: '',
          airline: '6H',
          airlineName: 'Israir',
          origin: 'TLV',
          destination,
          destinationCity: cityName,
          departureTime: `${date}T00:00:00.000Z`,
          source: 'israir',
          bookingUrl: buildBookingUrl(destination, date),
          lastSeen: now,
        });
      }
    }

    // Deduplicate by id (same dest+date pair)
    const seen = new Set<string>();
    const deduped: Flight[] = [];
    for (const f of flights) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        deduped.push(f);
      }
    }

    console.log(`[israir] Produced ${deduped.length} flight records`);
    return deduped;
  } catch (error) {
    console.error('[israir] Failed to fetch flights:', error);
    return flights;
  }
}
