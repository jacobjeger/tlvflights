import { Flight } from '../types';

const API_BASE = 'https://api.amadeus.com';

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Amadeus API credentials not configured');
  }

  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const response = await fetch(`${API_BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });

  if (!response.ok) {
    throw new Error(`Amadeus auth failed: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
}

export async function fetchAmadeusFlights(): Promise<Flight[]> {
  if (!process.env.AMADEUS_CLIENT_ID) {
    console.log('[amadeus] No API credentials configured, skipping');
    return [];
  }

  const token = await getAccessToken();
  const flights: Flight[] = [];
  const now = new Date().toISOString();

  // Search flights from TLV for the next 7 days
  const origins = ['TLV', 'TCP'];

  for (const origin of origins) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().slice(0, 10);

      try {
        const params = new URLSearchParams({
          originLocationCode: origin,
          departureDate: dateStr,
          adults: '1',
          nonStop: 'false',
          max: '50',
        });

        const response = await fetch(
          `${API_BASE}/v2/shopping/flight-offers?${params}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`[amadeus] Rate limited for ${origin} on ${dateStr}`);
            continue;
          }
          continue;
        }

        const data = await response.json();

        if (data.data) {
          for (const offer of data.data) {
            const segment = offer.itineraries?.[0]?.segments?.[0];
            if (!segment) continue;

            const airlineCode = segment.carrierCode;
            const flightNum = `${airlineCode}${segment.number}`;
            const id = `amadeus_${flightNum}_${dateStr}`;

            flights.push({
              id,
              flightNumber: flightNum,
              airline: airlineCode,
              airlineName: getAirlineName(airlineCode),
              origin,
              destination: segment.arrival?.iataCode || '',
              destinationCity: segment.arrival?.iataCode || '',
              departureTime: segment.departure?.at || dateStr,
              arrivalTime: segment.arrival?.at,
              price: parseFloat(offer.price?.total) || undefined,
              currency: offer.price?.currency,
              seatsAvailable: offer.numberOfBookableSeats,
              cabinClass: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin,
              source: 'amadeus',
              bookingUrl: undefined,
              lastSeen: now,
            });
          }
        }
      } catch (error) {
        console.error(`[amadeus] Error fetching ${origin} ${dateStr}:`, error);
      }
    }
  }

  return flights;
}

function getAirlineName(code: string): string {
  const names: Record<string, string> = {
    LY: 'El Al',
    IZ: 'Arkia',
    '6H': 'Israir',
    E2: 'Air Haifa',
  };
  return names[code] || code;
}
