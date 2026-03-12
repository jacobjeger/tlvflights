export interface Flight {
  id: string;
  flightNumber: string;
  airline: string; // IATA code: LY, IZ, 6H, E2
  airlineName: string;
  origin: string; // TLV or TCP
  destination: string; // IATA airport code
  destinationCity: string;
  departureTime: string; // ISO 8601
  arrivalTime?: string;
  price?: number;
  currency?: string;
  seatsAvailable?: number; // undefined if unknown
  cabinClass?: string;
  source: string; // elal, israir, airhaifa, arkia, amadeus, kiwi
  bookingUrl?: string;
  lastSeen: string; // ISO 8601
}

export interface SyncLog {
  id: number;
  source: string;
  status: 'success' | 'error';
  flightsFound: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export const AIRLINES: Record<string, { name: string; iata: string }> = {
  LY: { name: 'El Al', iata: 'LY' },
  IZ: { name: 'Arkia', iata: 'IZ' },
  '6H': { name: 'Israir', iata: '6H' },
  E2: { name: 'Air Haifa', iata: 'E2' },
};

export const AIRPORTS: Record<string, { name: string; city: string; country: string }> = {
  TLV: { name: 'Ben Gurion International', city: 'Tel Aviv', country: 'Israel' },
  TCP: { name: 'Taba International', city: 'Taba', country: 'Egypt' },
};
