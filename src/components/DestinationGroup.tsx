'use client';

import { useState } from 'react';
import { Flight } from '@/lib/types';
import { getFlagForAirport } from '@/lib/countries';
import FlightCard from './FlightCard';
import type { GroupedFlights } from './FlightBoard';

interface DestinationGroupProps {
  group: GroupedFlights;
}

export default function DestinationGroup({ group }: DestinationGroupProps) {
  return (
    <section className="fade-in-up">
      {/* Region header */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          {group.regionName}
        </h2>
        <div className="h-px flex-1 bg-zinc-800/80" />
        <span className="text-[10px] text-zinc-600">
          {group.destinations.length} destination{group.destinations.length !== 1 ? 's' : ''}
          {' / '}
          {group.totalFlights} flight{group.totalFlights !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Destination cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.destinations.map((dest) => (
          <DestinationCard
            key={dest.code}
            code={dest.code}
            city={dest.city}
            flights={dest.flights}
          />
        ))}
      </div>
    </section>
  );
}

interface DestinationCardProps {
  code: string;
  city: string;
  flights: Flight[];
}

function DestinationCard({ code, city, flights }: DestinationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const displayFlights = expanded ? flights : flights.slice(0, 3);
  const hasMore = flights.length > 3;
  const flag = getFlagForAirport(code);

  const lowestPrice = flights.reduce((min: number | null, f: Flight) => {
    if (f.price != null && (min === null || f.price < min)) return f.price;
    return min;
  }, null);

  const soonest = flights[0];
  const soonestTime = soonest
    ? new Date(soonest.departureTime).toLocaleTimeString('en-IL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jerusalem',
      })
    : null;

  return (
    <div className="card overflow-hidden transition-all duration-200 hover:border-zinc-700">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-zinc-800/30"
      >
        {/* Flag + Code */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80">
          {flag ? (
            <span className="text-lg">{flag}</span>
          ) : (
            <span className="mono text-[10px] font-bold text-zinc-500">{code}</span>
          )}
        </div>

        {/* City info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-zinc-100">{city}</span>
            <span className="mono text-[10px] text-zinc-600">{code}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span>{flights.length} flight{flights.length !== 1 ? 's' : ''}</span>
            {lowestPrice != null && (
              <>
                <span className="text-zinc-700">&middot;</span>
                <span className="font-medium text-emerald-400">from ${lowestPrice}</span>
              </>
            )}
            {soonestTime && (
              <>
                <span className="text-zinc-700">&middot;</span>
                <span>Next: {soonestTime}</span>
              </>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Flights */}
      <div className="border-t border-zinc-800/50">
        {displayFlights.map((flight, i) => (
          <FlightCard
            key={flight.id}
            flight={flight}
            isLast={i === displayFlights.length - 1 && !hasMore}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:text-amber-400"
          >
            {expanded
              ? 'Show less'
              : `+${flights.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}
