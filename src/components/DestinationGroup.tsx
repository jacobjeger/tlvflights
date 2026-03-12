'use client';

import { useState } from 'react';
import { Flight } from '@/lib/types';
import FlightCard from './FlightCard';

interface DestinationGroupProps {
  group: {
    regionId: string;
    regionName: string;
    destinations: {
      code: string;
      city: string;
      flights: Flight[];
    }[];
    totalFlights: number;
  };
}

export default function DestinationGroup({ group }: DestinationGroupProps) {
  return (
    <section className="fade-in-up">
      {/* Region header */}
      <div className="dest-group mb-3">
        <span>{group.regionName}</span>
        <span className="text-xs font-normal normal-case tracking-normal text-zinc-600">
          {group.destinations.length} destination{group.destinations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Destination cards in a grid */}
      <div className="grid gap-3 sm:grid-cols-2">
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
  const displayFlights = expanded ? flights : flights.slice(0, 2);
  const hasMore = flights.length > 2;

  // Find lowest price
  const lowestPrice = flights.reduce((min, f) => {
    if (f.price != null && (min === null || f.price < min)) return f.price;
    return min;
  }, null as number | null);

  // Count available seats info
  const availableCount = flights.filter(
    (f) => f.seatsAvailable === undefined || (f.seatsAvailable != null && f.seatsAvailable > 0),
  ).length;

  return (
    <div className="flight-card">
      {/* Destination header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300 mono">
            {code}
          </div>
          <div>
            <div className="text-base font-semibold text-zinc-100">{city}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>
                {flights.length} flight{flights.length !== 1 ? 's' : ''}
              </span>
              {lowestPrice != null && (
                <>
                  <span className="text-zinc-700">|</span>
                  <span className="text-emerald-400">
                    from ${lowestPrice}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {availableCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
              {availableCount} available
            </span>
          )}
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Flight list */}
      <div className="border-t border-zinc-800/50">
        {displayFlights.map((flight, i) => (
          <FlightCard key={flight.id} flight={flight} isLast={i === displayFlights.length - 1 && !hasMore} />
        ))}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-1 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:text-amber-400"
          >
            {expanded ? 'Show less' : `Show ${flights.length - 2} more flight${flights.length - 2 !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
