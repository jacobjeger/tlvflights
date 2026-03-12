'use client';

import { Flight } from '@/lib/types';
import BookingLink from './BookingLink';

interface FlightRowProps {
  flight: Flight;
}

function getAirlineBadgeClass(airline: string): string {
  const map: Record<string, string> = {
    LY: 'airline-badge-LY',
    IZ: 'airline-badge-IZ',
    '6H': 'airline-badge-6H',
    E2: 'airline-badge-E2',
  };
  return map[airline] || 'bg-neutral-600 text-white';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  });
}

function formatPrice(price?: number, currency?: string): string | null {
  if (price == null) return null;
  const cur = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${cur} ${price}`;
  }
}

function isStale(lastSeen: string): boolean {
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff > 30 * 60 * 1000;
}

function getSeatsBadge(seats?: number): { text: string; className: string } {
  if (seats === undefined || seats === null) {
    return { text: 'Unknown', className: 'seats-unknown' };
  }
  if (seats === 0) {
    return { text: 'Sold Out', className: 'seats-sold-out' };
  }
  if (seats < 10) {
    return { text: `${seats} Left`, className: 'seats-limited' };
  }
  return { text: 'Available', className: 'seats-available' };
}

export default function FlightRow({ flight }: FlightRowProps) {
  const stale = isStale(flight.lastSeen);
  const seatsBadge = getSeatsBadge(flight.seatsAvailable);
  const priceStr = formatPrice(flight.price, flight.currency);

  return (
    <div className={`flight-row fade-in ${stale ? 'stale' : ''}`}>
      {/* Top row: flight number, airline, seats badge */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${getAirlineBadgeClass(flight.airline)}`}
          >
            {flight.airline}
          </span>
          <span className="mono text-base font-semibold text-amber-400">
            {flight.flightNumber}
          </span>
          <span className="hidden text-sm text-neutral-500 sm:inline">
            {flight.airlineName}
          </span>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${seatsBadge.className}`}>
          {seatsBadge.text}
        </span>
      </div>

      {/* Airline name on mobile */}
      <div className="mb-2 text-xs text-neutral-500 sm:hidden">
        {flight.airlineName}
      </div>

      {/* Middle row: destination, time, price */}
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-medium leading-tight text-neutral-100">
            {flight.destinationCity}
          </div>
          <div className="mono mt-0.5 text-xs text-neutral-500">
            {flight.destination}
          </div>
        </div>

        <div className="text-right">
          <div className="mono text-xl font-bold text-amber-400">
            {formatTime(flight.departureTime)}
          </div>
          {priceStr && (
            <div className="mt-0.5 text-sm font-semibold text-green-400">
              {priceStr}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: stale warning + booking */}
      <div className="flex items-center justify-between">
        <div>
          {stale && (
            <span className="text-xs text-amber-600">
              May be unavailable
            </span>
          )}
        </div>
        <BookingLink bookingUrl={flight.bookingUrl} airlineName={flight.airlineName} />
      </div>
    </div>
  );
}
