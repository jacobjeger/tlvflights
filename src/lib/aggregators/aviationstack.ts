import { execSync } from 'child_process';
import { Flight } from '../types';

// Free plan uses HTTP; paid plans can use HTTPS
const API_BASE = process.env['AVIATIONSTACK_HTTPS'] === 'true'
  ? 'https://api.aviationstack.com/v1'
  : 'http://api.aviationstack.com/v1';

/**
 * Read an env var, falling back to reading directly from the OS
 * in case Next.js webpack has stripped it from process.env.
 */
function getEnvVar(name: string): string | undefined {
  const val = process.env[name];
  if (val) return val;
  try {
    return execSync(`printenv ${name} 2>/dev/null`).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

interface AviationStackFlight {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    scheduled: string;
    estimated: string;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    scheduled: string;
    estimated: string;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
  };
  airline: {
    name: string;
    iata: string;
  };
  flight: {
    number: string;
    iata: string;
  };
}

interface TimetableFlight {
  flight_date: string;
  departure: {
    airport: string;
    iata: string;
    scheduled: string;
    terminal: string | null;
  };
  arrival: {
    airport: string;
    iata: string;
    scheduled: string;
    terminal: string | null;
  };
  airline: {
    name: string;
    iata: string;
  };
  flight: {
    number: string;
    iata: string;
  };
  status: string;
}

const AIRLINE_CODES: Record<string, string> = {
  LY: 'El Al',
  IZ: 'Arkia',
  '6H': 'Israir',
  E2: 'Air Haifa',
  TK: 'Turkish Airlines',
  LH: 'Lufthansa',
  AF: 'Air France',
  BA: 'British Airways',
  KL: 'KLM',
  AZ: 'ITA Airways',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  EY: 'Etihad',
  W6: 'Wizz Air',
  FR: 'Ryanair',
  U2: 'easyJet',
  PC: 'Pegasus',
  RJ: 'Royal Jordanian',
  MS: 'EgyptAir',
  SU: 'Aeroflot',
  OS: 'Austrian',
  LX: 'Swiss',
  SK: 'SAS',
  AY: 'Finnair',
  TP: 'TAP Portugal',
  A3: 'Aegean',
  SN: 'Brussels Airlines',
  LO: 'LOT Polish',
  OK: 'Czech Airlines',
  RO: 'TAROM',
  FB: 'Bulgaria Air',
  PS: 'UIA',
  B2: 'Belavia',
  BT: 'Air Baltic',
  OV: 'SalamAir',
  HY: 'Uzbekistan Airways',
  J2: 'Azerbaijan Airlines',
  GQ: 'Sky Express',
};

function getAirlineName(iata: string): string {
  return AIRLINE_CODES[iata] || iata;
}

// City name lookup for common airports
const CITY_NAMES: Record<string, string> = {
  JFK: 'New York', EWR: 'Newark', LAX: 'Los Angeles', MIA: 'Miami',
  ORD: 'Chicago', SFO: 'San Francisco', BOS: 'Boston', IAD: 'Washington',
  ATL: 'Atlanta', DFW: 'Dallas', LHR: 'London', CDG: 'Paris',
  AMS: 'Amsterdam', FRA: 'Frankfurt', MUC: 'Munich', BER: 'Berlin',
  FCO: 'Rome', MXP: 'Milan', BCN: 'Barcelona', MAD: 'Madrid',
  LIS: 'Lisbon', ZRH: 'Zurich', GVA: 'Geneva', VIE: 'Vienna',
  PRG: 'Prague', BUD: 'Budapest', WAW: 'Warsaw', ATH: 'Athens',
  SKG: 'Thessaloniki', RHO: 'Rhodes', HER: 'Heraklion', JTR: 'Santorini',
  LCA: 'Larnaca', PFO: 'Paphos', IST: 'Istanbul', AYT: 'Antalya',
  SSH: 'Sharm el-Sheikh', HRG: 'Hurghada', CAI: 'Cairo', AMM: 'Amman',
  DXB: 'Dubai', DOH: 'Doha', AUH: 'Abu Dhabi', TBS: 'Tbilisi',
  BAK: 'Baku', EVN: 'Yerevan', OTP: 'Bucharest', SOF: 'Sofia',
  BEG: 'Belgrade', TIA: 'Tirana', DBV: 'Dubrovnik', CPH: 'Copenhagen',
  ARN: 'Stockholm', OSL: 'Oslo', HEL: 'Helsinki', YYZ: 'Toronto',
  BKK: 'Bangkok', BOM: 'Mumbai', DEL: 'Delhi', ADD: 'Addis Ababa',
  NBO: 'Nairobi', JNB: 'Johannesburg', VAR: 'Varna', BOJ: 'Burgas',
  KRK: 'Krakow', SKP: 'Skopje', TIV: 'Tivat', MLA: 'Malta',
  VCE: 'Venice', NAP: 'Naples', BLQ: 'Bologna', CTA: 'Catania',
};

function getCityName(iata: string, airportName?: string): string {
  if (CITY_NAMES[iata]) return CITY_NAMES[iata];
  // Try to extract city from airport name (e.g. "London Heathrow" -> "London")
  if (airportName) {
    const parts = airportName.split(' ');
    if (parts.length > 1) return parts[0];
    return airportName;
  }
  return iata;
}

/**
 * Fetch real-time departures from TLV using AviationStack.
 * Uses the /flights endpoint for real-time and /timetable for schedules.
 */
export async function fetchAviationStackFlights(): Promise<Flight[]> {
  const apiKey = getEnvVar('AVIATIONSTACK_API_KEY');
  console.log('[aviationstack] API key found:', !!apiKey, apiKey ? `(${apiKey.length} chars)` : '');
  if (!apiKey) {
    console.log('[aviationstack] No API key configured, skipping');
    return [];
  }

  const flights: Flight[] = [];
  const now = new Date().toISOString();
  const origins = ['TLV'];

  for (const origin of origins) {
    try {
      // Use /flights endpoint for real-time departure data
      const params = new URLSearchParams({
        access_key: apiKey,
        dep_iata: origin,
        flight_status: 'scheduled',
        limit: '100',
      });

      console.log(`[aviationstack] Fetching departures from ${origin}...`);
      const response = await fetch(`${API_BASE}/flights?${params}`);

      if (!response.ok) {
        const text = await response.text();
        console.error(`[aviationstack] HTTP ${response.status}: ${text.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        console.error(`[aviationstack] API error:`, data.error.message || data.error);
        continue;
      }

      const results: AviationStackFlight[] = data.data || [];
      console.log(`[aviationstack] Got ${results.length} flights from ${origin}`);

      for (const f of results) {
        if (!f.departure?.iata || !f.arrival?.iata) continue;
        if (!f.flight?.iata) continue;

        const airlineCode = f.airline?.iata || f.flight.iata.slice(0, 2);
        const depTime = f.departure.scheduled || f.departure.estimated;
        if (!depTime) continue;

        const id = `avstack_${f.flight.iata}_${f.flight_date}`;

        flights.push({
          id,
          flightNumber: f.flight.iata,
          airline: airlineCode,
          airlineName: f.airline?.name || getAirlineName(airlineCode),
          origin: f.departure.iata,
          destination: f.arrival.iata,
          destinationCity: getCityName(f.arrival.iata, f.arrival.airport),
          departureTime: depTime,
          arrivalTime: f.arrival.scheduled || f.arrival.estimated || undefined,
          price: undefined, // AviationStack doesn't provide pricing
          currency: undefined,
          seatsAvailable: undefined,
          cabinClass: undefined,
          source: 'aviationstack',
          bookingUrl: undefined,
          lastSeen: now,
        });
      }
    } catch (error) {
      console.error(`[aviationstack] Error fetching ${origin}:`, error);
    }

    // Also try /timetable for future schedules (if on paid plan or if /flights was limited)
    try {
      const params = new URLSearchParams({
        access_key: apiKey,
        dep_iata: origin,
        type: 'departure',
      });

      console.log(`[aviationstack] Fetching timetable for ${origin}...`);
      const response = await fetch(`${API_BASE}/timetable?${params}`);

      if (!response.ok) continue;
      const data = await response.json();
      if (data.error) continue;

      const results: TimetableFlight[] = data.data || [];
      console.log(`[aviationstack] Got ${results.length} timetable entries from ${origin}`);

      for (const f of results) {
        if (!f.departure?.iata || !f.arrival?.iata) continue;
        if (!f.flight?.iata) continue;

        const airlineCode = f.airline?.iata || f.flight.iata.slice(0, 2);
        const depTime = f.departure.scheduled;
        if (!depTime) continue;

        const id = `avstack_tt_${f.flight.iata}_${f.flight_date}`;

        // Skip if we already have this flight from /flights endpoint
        if (flights.some((existing) => existing.flightNumber === f.flight.iata && existing.departureTime.slice(0, 10) === f.flight_date)) {
          continue;
        }

        flights.push({
          id,
          flightNumber: f.flight.iata,
          airline: airlineCode,
          airlineName: f.airline?.name || getAirlineName(airlineCode),
          origin: f.departure.iata,
          destination: f.arrival.iata,
          destinationCity: getCityName(f.arrival.iata, f.arrival.airport),
          departureTime: depTime,
          arrivalTime: f.arrival.scheduled || undefined,
          price: undefined,
          currency: undefined,
          seatsAvailable: undefined,
          cabinClass: undefined,
          source: 'aviationstack',
          bookingUrl: undefined,
          lastSeen: now,
        });
      }
    } catch {
      // Timetable might not be available on free plan, that's fine
    }
  }

  return flights;
}
