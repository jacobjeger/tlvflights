/**
 * Airline API clients barrel export.
 *
 * Each fetch function returns Promise<Flight[]> and never throws.
 * Blocked airlines (El Al, Arkia, Air Haifa) require a proxy service
 * configured via ZENROWS_API_KEY or SCRAPINGBEE_API_KEY env vars.
 * Without a proxy they gracefully return empty arrays.
 */

export { fetchIsrairFlights } from './israir';
export { fetchElAlFlights } from './elal';
export { fetchArkiaFlights } from './arkia';
export { fetchAirHaifaFlights } from './airhaifa';
export { fetchWithProxy, isProxyConfigured } from './proxy';
