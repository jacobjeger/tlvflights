'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flight, AIRLINES } from '@/lib/types';
import { REGIONS, getRegionForDestination, getRegionName } from '@/lib/regions';
import DestinationGroup from './DestinationGroup';
import UrgentFlights from './UrgentFlights';
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
    const sublabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    options.push({ value, label, sublabel });
  }
  return options;
}

export interface GroupedFlights {
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
  const byDest = new Map<string, Flight[]>();
  for (const f of flights) {
    const key = f.destination;
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push(f);
  }

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

  for (const regionId of Object.keys(byRegion)) {
    byRegion[regionId].sort((a: { city: string }, b: { city: string }) =>
      a.city.localeCompare(b.city),
    );
  }

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
    <div className="space-y-6">
      {/* Skeleton stats */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="skeleton mb-2 h-7 w-12" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Skeleton groups */}
      {[1, 2].map((i) => (
        <div key={i}>
          <div className="skeleton mb-3 h-4 w-40" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="card p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <div className="skeleton mb-1.5 h-5 w-24" />
                    <div className="skeleton h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="skeleton h-10 w-full rounded-lg" />
                  <div className="skeleton h-10 w-full rounded-lg" />
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

  // Filter flights
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

  // Urgent: flights departing within 8 hours
  const urgentFlights = useMemo(() => {
    const cutoff = Date.now() + 8 * 60 * 60 * 1000;
    return filteredFlights
      .filter((f) => {
        const dep = new Date(f.departureTime).getTime();
        return dep > Date.now() && dep < cutoff;
      })
      .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
  }, [filteredFlights]);

  // Region counts
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: flights.length };
    for (const f of flights) {
      const rid = getRegionForDestination(f.destination);
      counts[rid] = (counts[rid] || 0) + 1;
    }
    return counts;
  }, [flights]);

  // Stats
  const stats = useMemo(() => {
    const destSet = new Set(filteredFlights.map((f) => f.destination));
    const airlineSet = new Set(filteredFlights.map((f) => f.airline));
    return {
      totalFlights: filteredFlights.length,
      destinations: destSet.size,
      airlines: airlineSet.size,
    };
  }, [filteredFlights]);

  const airlineKeys = Object.keys(AIRLINES);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="text-amber-400">TLV</span>{' '}
              <span className="text-zinc-100">Flights</span>
            </h1>
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
              Real-time available seats from Israeli airports
            </p>
          </div>
          <StatusBar
            lastSync={lastSync}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        </div>
      </header>

      {/* Search + Origin */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city or code..."
            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex h-10 rounded-xl border border-zinc-800 bg-zinc-900 p-0.5">
          {[
            { code: 'TLV', label: 'TLV' },
            { code: 'TCP', label: 'Taba' },
          ].map((airport) => (
            <button
              key={airport.code}
              onClick={() => setSelectedOrigin(airport.code)}
              className={`rounded-lg px-3 text-xs font-bold transition-all ${
                selectedOrigin === airport.code
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {airport.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Selector */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedDate(null)}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            selectedDate === null
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
          }`}
        >
          All Dates
        </button>
        {dateOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedDate(selectedDate === opt.value ? null : opt.value)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-center transition-all ${
              selectedDate === opt.value
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <div className="text-xs font-semibold">{opt.label}</div>
            <div className="text-[10px] opacity-60">{opt.sublabel}</div>
          </button>
        ))}
      </div>

      {/* Filters Row: Region + Airline */}
      <div className="flex flex-col gap-2">
        {/* Regions */}
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-thin">
          {REGIONS.filter((r) => r.id === 'all' || (regionCounts[r.id] || 0) > 0).map((region) => {
            const count = regionCounts[region.id] || 0;
            const isActive = selectedRegion === region.id;
            return (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
              >
                {region.name}
                {count > 0 && (
                  <span className={`ml-1 text-[10px] ${isActive ? 'text-zinc-600' : 'text-zinc-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Airlines */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedAirline(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              selectedAirline === null
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All Airlines
          </button>
          {airlineKeys.map((code) => (
            <button
              key={code}
              onClick={() => setSelectedAirline(selectedAirline === code ? null : code)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedAirline === code
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  code === 'LY' ? 'bg-[#003f87]' : code === 'IZ' ? 'bg-[#e97c00]' : code === '6H' ? 'bg-[#00a651]' : 'bg-[#0d9488]'
                }`}
              />
              {AIRLINES[code].name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonRows />
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="card px-4 py-3">
              <div className="text-xl font-bold text-zinc-100">{stats.totalFlights}</div>
              <div className="text-[11px] text-zinc-500">Flights</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xl font-bold text-amber-400">{stats.destinations}</div>
              <div className="text-[11px] text-zinc-500">Destinations</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xl font-bold text-zinc-100">{stats.airlines}</div>
              <div className="text-[11px] text-zinc-500">Airlines</div>
            </div>
          </div>

          {/* Urgent Flights */}
          {urgentFlights.length > 0 && (
            <UrgentFlights flights={urgentFlights} />
          )}

          {/* Grouped Results */}
          {filteredFlights.length === 0 ? (
            <div className="card flex flex-col items-center py-16 text-center">
              <svg className="mb-3 h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              <div className="text-sm font-medium text-zinc-400">No flights found</div>
              <p className="mt-1 max-w-xs text-xs text-zinc-600">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : 'Try changing date, region, or airline filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <DestinationGroup key={group.regionId} group={group} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
