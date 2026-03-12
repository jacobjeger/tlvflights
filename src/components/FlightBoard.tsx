'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flight, AIRLINES } from '@/lib/types';
import AirportTabs from './AirportTabs';
import FlightRow from './FlightRow';
import StatusBar from './StatusBar';

interface ApiResponse {
  flights: Flight[];
  lastSync: { source: string; completedAt: string; status: string } | null;
  timestamp: string;
}

function getDateOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="board-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="skeleton h-5 w-8" />
              <div className="skeleton h-5 w-20" />
            </div>
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="skeleton mb-1 h-6 w-32" />
              <div className="skeleton h-3 w-10" />
            </div>
            <div className="text-right">
              <div className="skeleton mb-1 h-7 w-16" />
              <div className="skeleton h-4 w-12" />
            </div>
          </div>
          <div className="flex justify-end">
            <div className="skeleton h-8 w-16 rounded-md" />
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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
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

  const airlineKeys = Object.keys(AIRLINES);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
            TLV Flights
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Available seats from Israeli airports
          </p>
        </div>
      </header>

      {/* Status Bar */}
      <StatusBar
        lastSync={lastSync}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* Airport Tabs */}
      <AirportTabs selected={selectedOrigin} onChange={setSelectedOrigin} />

      {/* Date Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {dateOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedDate(opt.value)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              selectedDate === opt.value
                ? 'bg-amber-500 text-black'
                : 'bg-[#1a1a1a] text-neutral-400 hover:bg-[#222] hover:text-neutral-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Airline Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedAirline(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedAirline === null
              ? 'bg-neutral-200 text-black'
              : 'bg-[#1a1a1a] text-neutral-400 hover:bg-[#222]'
          }`}
        >
          All Airlines
        </button>
        {airlineKeys.map((code) => (
          <button
            key={code}
            onClick={() => setSelectedAirline(selectedAirline === code ? null : code)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedAirline === code
                ? 'bg-neutral-200 text-black'
                : 'bg-[#1a1a1a] text-neutral-400 hover:bg-[#222]'
            }`}
          >
            {AIRLINES[code].name}
          </button>
        ))}
      </div>

      {/* Flight List */}
      {loading ? (
        <SkeletonRows />
      ) : flights.length === 0 ? (
        <div className="board-surface flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-2 text-lg font-medium text-neutral-400">
            No flights found
          </div>
          <p className="max-w-xs text-sm text-neutral-600">
            There are no flights matching your filters. Try a different date or airport.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flights.map((flight) => (
            <FlightRow key={flight.id} flight={flight} />
          ))}
        </div>
      )}

      {/* Flight count */}
      {!loading && flights.length > 0 && (
        <p className="text-center text-xs text-neutral-600">
          {flights.length} flight{flights.length !== 1 ? 's' : ''} found
        </p>
      )}
    </div>
  );
}
