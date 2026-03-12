'use client';

import { Flight } from '@/lib/types';
import { getFlagForAirport } from '@/lib/countries';

interface UrgentFlightsProps {
  flights: Flight[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  });
}

function getTimeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getAirlineColor(code: string): string {
  const colors: Record<string, string> = {
    LY: 'border-l-[#003f87]',
    IZ: 'border-l-[#e97c00]',
    '6H': 'border-l-[#00a651]',
    E2: 'border-l-[#0d9488]',
  };
  return colors[code] || 'border-l-zinc-600';
}

export default function UrgentFlights({ flights }: UrgentFlightsProps) {
  const displayed = flights.slice(0, 6);

  return (
    <div className="fade-in-up">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-500 pulse-dot" />
        <span className="text-xs font-bold uppercase tracking-wider text-red-400">
          Departing Soon
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((flight) => {
          const flag = getFlagForAirport(flight.destination);
          return (
            <a
              key={flight.id}
              href={flight.bookingUrl || '#'}
              target={flight.bookingUrl ? '_blank' : undefined}
              rel="noopener noreferrer"
              className={`group flex items-center gap-3 rounded-xl border border-zinc-800 border-l-[3px] bg-zinc-900/80 px-3 py-2.5 transition-all hover:border-zinc-700 hover:bg-zinc-800/80 ${getAirlineColor(flight.airline)}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {flag && <span className="text-sm">{flag}</span>}
                  <span className="truncate text-sm font-semibold text-zinc-100">
                    {flight.destinationCity || flight.destination}
                  </span>
                  <span className="mono text-[10px] text-zinc-600">{flight.destination}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                  <span>{flight.airlineName}</span>
                  {flight.flightNumber && (
                    <span className="mono text-zinc-600">{flight.flightNumber}</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="mono text-sm font-bold text-amber-400">
                  {formatTime(flight.departureTime)}
                </div>
                <div className="text-[10px] font-semibold text-red-400">
                  in {getTimeUntil(flight.departureTime)}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
