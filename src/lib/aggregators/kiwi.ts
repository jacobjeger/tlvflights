import { Flight } from '../types';

const API_BASE = 'https://tequila-api.kiwi.com';

export async function fetchKiwiFlights(): Promise<Flight[]> {
  const apiKey = process.env['KIWI_API_KEY'];
  if (!apiKey) {
    console.log('[kiwi] No API key configured, skipping');
    return [];
  }

  const flights: Flight[] = [];
  const now = new Date().toISOString();
  const origins = ['TLV', 'TCP'];

  for (const origin of origins) {
    try {
      const dateFrom = formatDate(new Date());
      const dateTo = formatDate(addDays(new Date(), 7));

      const params = new URLSearchParams({
        fly_from: origin,
        date_from: dateFrom,
        date_to: dateTo,
        flight_type: 'oneway',
        adults: '1',
        limit: '50',
        sort: 'date',
        asc: '1',
      });

      const response = await fetch(`${API_BASE}/v2/search?${params}`, {
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        console.error(`[kiwi] Error fetching ${origin}: ${response.status}`);
        continue;
      }

      const data = await response.json() as any;

      if (data.data) {
        for (const itinerary of data.data) {
          const route = itinerary.route?.[0];
          if (!route) continue;

          const airlineCode = route.airline;
          const flightNum = `${airlineCode}${route.flight_no}`;
          const depDate = new Date(route.dTimeUTC * 1000).toISOString().slice(0, 10);
          const id = `kiwi_${flightNum}_${depDate}`;

          flights.push({
            id,
            flightNumber: flightNum,
            airline: airlineCode,
            airlineName: getAirlineName(airlineCode),
            origin,
            destination: route.flyTo,
            destinationCity: itinerary.cityTo || route.flyTo,
            departureTime: new Date(route.dTimeUTC * 1000).toISOString(),
            arrivalTime: new Date(route.aTimeUTC * 1000).toISOString(),
            price: itinerary.price,
            currency: itinerary.currency || 'EUR',
            seatsAvailable: itinerary.availability?.seats,
            cabinClass: undefined,
            source: 'kiwi',
            bookingUrl: itinerary.deep_link,
            lastSeen: now,
          });
        }
      }
    } catch (error) {
      console.error(`[kiwi] Error fetching ${origin}:`, error);
    }
  }

  return flights;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
