/**
 * Israir (6H) API client.
 *
 * Sometimes works directly, sometimes blocked by Imperva/Incapsula.
 * Fetches all outbound one-way flights from TLV with availability.
 * Will need proxy service for reliable access.
 */

import crypto from 'crypto';
import type { Flight } from '../types';
import { fetchWithProxy } from './proxy';

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
    const fetchTimeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetchWithProxy(url, {
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

    // Log structure for debugging
    const calendarKeys = Object.keys(calendarMap).sort();
    const sampleKey = calendarKeys[0];
    const sampleVal = sampleKey ? calendarMap[sampleKey] : null;
    console.log(
      `[israir] Found ${destLocations.length} destinations, ` +
        `${calendarKeys.length} calendar entries. ` +
        `Sample: ${sampleKey} => ${JSON.stringify(sampleVal).slice(0, 200)}`,
    );

    // Limit to next 14 days
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14);
    const maxDateStr = maxDate.toISOString().slice(0, 10);

    // calendarMap structure: { "YYYY-MM-DD": [...destinations] }
    // If values are arrays of destination codes, use them directly.
    // Otherwise fall back to destLocations x available dates.
    const firstVal = sampleVal;
    const valuesAreDestArrays = Array.isArray(firstVal) &&
      firstVal.length > 0 && typeof firstVal[0] === 'string' &&
      firstVal[0].length >= 2 && firstVal[0].length <= 4;

    if (valuesAreDestArrays) {
      console.log('[israir] Using calendarMap destination-date pairs');
      for (const [date, dests] of Object.entries(calendarMap)) {
        if (date > maxDateStr) continue;
        const destList = Array.isArray(dests) ? dests : [];
        for (const destination of destList) {
          if (!destination || typeof destination !== 'string') continue;
          const cityName = getCityName(destination);
          flights.push({
            id: `6H_${destination}_${date}`,
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
    } else {
      // Values are not destination arrays — we only know which dates have ANY flights.
      // Show one entry per destination using the earliest available date (no cross-join).
      const availableDates = calendarKeys.filter(d => d <= maxDateStr).sort();
      const earliestDate = availableDates[0] || today;
      console.log(`[israir] Using earliest available date ${earliestDate} for ${destLocations.length} destinations`);
      for (const destination of destLocations) {
        const cityName = getCityName(destination);
        flights.push({
          id: `6H_${destination}_${earliestDate}`,
          flightNumber: '',
          airline: '6H',
          airlineName: 'Israir',
          origin: 'TLV',
          destination,
          destinationCity: cityName,
          departureTime: `${earliestDate}T00:00:00.000Z`,
          source: 'israir',
          bookingUrl: buildBookingUrl(destination, earliestDate),
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
