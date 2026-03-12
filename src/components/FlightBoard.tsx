'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flight, AIRLINES } from '@/lib/types';
import { REGIONS, getRegionForDestination, getRegionName } from '@/lib/regions';
import DestinationGroup from './DestinationGroup';
import StatusBar from './StatusBar';

interface ApiResponse {
  flights: Flight[];
  lastSync: { source: string; completedAt: string; status: string } | null;
  timestamp: string;
}

function getDateOptions(): { value: string; label: string; sublabel: string }[] {
  const options: { value: string; label: string; sublabel: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short' });
    const sublabel =
      i <= 1
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    options.push({ value, label, sublabel });
  }
  return options;
}

interface GroupedFlights {
  regionId: string;
  regionName: string;
  destinations: {
    code: string;
    city: string;
    flights: Flight[];
  }[];
  totalFlights: number;
}

function groupFlightsByRegionAndDestination(flights: Flight[]): GroupedFlights[] {
  // Group by destination first
  const byDest = new Map<string, Flight[]>();
  for (const f of flights) {
    const key = f.destination;
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push(f);
  }

  // Group destinations by region
  const byRegion: Record<string, { code: string; city: string; flights: Flight[] }[]> = {};
  for (const [dest, destFlights] of Array.from(byDest)) {
    const regionId = getRegionForDestination(dest);
    if (!byRegion[regionId]) byRegion[regionId] = [];
    byRegion[regionId].push({
      code: dest,
      city: destFlights[0].destinationCity || dest,
      flights: destFlights.sort(
        (a: Flight, b: Flight) =>
          new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
      ),
    });
  }

  // Sort destinations within each region alphabetically by city name
  for (const regionId of Object.keys(byRegion)) {
    byRegion[regionId].sort((a: { city: string }, b: { city: string }) =>
      a.city.localeCompare(b.city),
    );
  }

  // Build final grouped array, ordered by REGIONS order
  const result: GroupedFlights[] = [];
  const regionOrder = REGIONS.filter((r) => r.id !== 'all').map((r) => r.id);

  for (const regionId of regionOrder) {
    const destinations = byRegion[regionId];
    if (destinations && destinations.length > 0) {
      const totalFlights = destinations.reduce((sum, d) => sum + d.flights.length, 0);
      result.push({
        regionId,
        regionName: getRegionName(regionId),
        destinations,
        totalFlights,
      });
    }
  }

  return result;
}

function SkeletonRows() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="skeleton mb-3 h-4 w-32" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[1, 2].map((j) => (
              <div key={j} className="card p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-lg" />
                  <div>
                    <div className="skeleton mb-1 h-5 w-28" />
                    <div className="skeleton h-3 w-16" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="skeleton h-5 w-14" />
                  <div className="skeleton h-8 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FlightBoard() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<ApiResponse['lastSync']>(null);
  const [selectedOrigin, setSelectedOrigin] = useState('TLV');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dateOptions = useMemo(() => getDateOptions(), []);

  const fetchFlights = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('origin', selectedOrigin);
      if (selectedDate) params.set('date', selectedDate);
      if (selectedAirline) params.set('airline', selectedAirline);

      const res = await fetch(`/api/flights?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ApiResponse = await res.json();
      setFlights(data.flights);
      setLastSync(data.lastSync);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedOrigin, selectedDate, selectedAirline]);

  useEffect(() => {
    setLoading(true);
    fetchFlights();
  }, [fetchFlights]);

  useEffect(() => {
    intervalRef.current = setInterval(fetchFlights, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFlights]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/refresh', { method: 'POST' });
      await fetchFlights();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter flights by search query and region
  const filteredFlights = useMemo(() => {
    let result = flights;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.destinationCity?.toLowerCase().includes(q) ||
          f.destination.toLowerCase().includes(q) ||
          f.airlineName.toLowerCase().includes(q),
      );
    }

    if (selectedRegion !== 'all') {
      result = result.filter((f) => getRegionForDestination(f.destination) === selectedRegion);
    }

    return result;
  }, [flights, searchQuery, selectedRegion]);

  const grouped = useMemo(
    () => groupFlightsByRegionAndDestination(filteredFlights),
    [filteredFlights],
  );

  // Compute region counts for badges
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: flights.length };
    for (const f of flights) {
      const rid = getRegionForDestination(f.destination);
      counts[rid] = (counts[rid] || 0) + 1;
    }
    return counts;
  }, [flights]);

  // Unique destination count
  const destinationCount = useMemo(() => {
    const s = new Set(filteredFlights.map((f) => f.destination));
    return s.size;
  }, [filteredFlights]);

  const airlineKeys = Object.keys(AIRLINES);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-amber-400">TLV</span> Flights
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Find any available seat out. Updated every 2 minutes.
          </p>
        </div>
        <StatusBar
          lastSync={lastSync}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </header>

      {/* Search + Origin Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destination city or airport code..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
          />
        </div>

        {/* Origin toggle */}
        <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {[
            { code: 'TLV', label: 'Ben Gurion' },
            { code: 'TCP', label: 'Taba' },
          ].map((airport) => (
            <button
              key={airport.code}
              onClick={() => setSelectedOrigin(airport.code)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                selectedOrigin === airport.code
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="mono text-xs font-bold">{airport.code}</span>{' '}
              <span className="hidden sm:inline">{airport.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedDate(null)}
          className={`region-pill shrink-0 ${
            selectedDate === null ? 'region-pill-active' : 'region-pill-inactive'
          }`}
        >
          All Dates
        </button>
        {dateOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedDate(selectedDate === opt.value ? null : opt.value)}
            className={`region-pill shrink-0 flex flex-col items-center leading-tight ${
              selectedDate === opt.value ? 'region-pill-active' : 'region-pill-inactive'
            }`}
          >
            <span className="text-xs font-semibold">{opt.label}</span>
            <span className="text-[10px] opacity-70">{opt.sublabel}</span>
          </button>
        ))}
      </div>

      {/* Region Filter + Airline Filter Row */}
      <div className="flex flex-col gap-3">
        {/* Region filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {REGIONS.filter((r) => r.id === 'all' || (regionCounts[r.id] || 0) > 0).map(
            (region) => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className={`region-pill shrink-0 flex items-center gap-1.5 ${
                  selectedRegion === region.id ? 'region-pill-active' : 'region-pill-inactive'
                }`}
              >
                {region.name}
                {(regionCounts[region.id] || 0) > 0 && (
                  <span
                    className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                      selectedRegion === region.id
                        ? 'bg-black/20 text-black'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}
                  >
                    {regionCounts[region.id]}
                  </span>
                )}
              </button>
            ),
          )}
        </div>

        {/* Airline filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedAirline(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedAirline === null
                ? 'bg-zinc-200 text-zinc-900'
                : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-700/80 hover:text-zinc-300'
            }`}
          >
            All Airlines
          </button>
          {airlineKeys.map((code) => (
            <button
              key={code}
              onClick={() => setSelectedAirline(selectedAirline === code ? null : code)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedAirline === code
                  ? 'bg-zinc-200 text-zinc-900'
                  : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-700/80 hover:text-zinc-300'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  code === 'LY'
                    ? 'bg-[#003f87]'
                    : code === 'IZ'
                      ? 'bg-[#e97c00]'
                      : code === '6H'
                        ? 'bg-[#00a651]'
                        : 'bg-[#0d9488]'
                }`}
              />
              {AIRLINES[code].name}
            </button>
          ))}
        </div>
      </div>

      {/* Results summary */}
      {!loading && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {filteredFlights.length} flight{filteredFlights.length !== 1 ? 's' : ''} to{' '}
            {destinationCount} destination{destinationCount !== 1 ? 's' : ''}
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-amber-500 hover:text-amber-400"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Flight List - Grouped by Region then Destination */}
      {loading ? (
        <SkeletonRows />
      ) : filteredFlights.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="mb-4 h-12 w-12 text-zinc-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
          <div className="mb-1 text-lg font-medium text-zinc-400">No flights found</div>
          <p className="max-w-sm text-sm text-zinc-600">
            {searchQuery
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'No flights match your current filters. Try changing the date, region, or airline.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <DestinationGroup key={group.regionId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
