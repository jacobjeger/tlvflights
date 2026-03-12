'use client';

import { Flight } from '@/lib/types';

interface FlightCardProps {
  flight: Flight;
  isLast?: boolean;
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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
  return Date.now() - new Date(lastSeen).getTime() > 30 * 60 * 1000;
}

function getAirlineColor(code: string): string {
  const colors: Record<string, string> = {
    LY: 'bg-[#003f87]',
    IZ: 'bg-[#e97c00]',
    '6H': 'bg-[#00a651]',
    E2: 'bg-[#0d9488]',
  };
  return colors[code] || 'bg-zinc-600';
}

function getSeatsBadge(seats?: number): { text: string; className: string } | null {
  if (seats === undefined || seats === null) return null;
  if (seats === 0) return { text: 'Sold out', className: 'seats-sold-out' };
  if (seats < 5) return { text: `${seats} left!`, className: 'seats-limited' };
  if (seats < 10) return { text: `${seats} left`, className: 'seats-limited' };
  return { text: 'Available', className: 'seats-available' };
}

export default function FlightCard({ flight, isLast }: FlightCardProps) {
  const stale = isStale(flight.lastSeen);
  const seatsBadge = getSeatsBadge(flight.seatsAvailable);
  const priceStr = formatPrice(flight.price, flight.currency);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/30 ${
        !isLast ? 'border-b border-zinc-800/30' : ''
      } ${stale ? 'opacity-40' : ''}`}
    >
      {/* Airline indicator */}
      <div
        className={`h-8 w-1 shrink-0 rounded-full ${getAirlineColor(flight.airline)}`}
        title={flight.airlineName}
      />

      {/* Flight info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">{flight.airlineName}</span>
          {flight.flightNumber && (
            <span className="mono text-xs text-zinc-600">{flight.flightNumber}</span>
          )}
          {seatsBadge && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${seatsBadge.className}`}
            >
              {seatsBadge.text}
            </span>
          )}
          {stale && (
            <span className="text-[10px] text-amber-600">May be unavailable</span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="mono text-sm font-semibold text-zinc-200">
            {formatTime(flight.departureTime)}
          </span>
          <span className="text-xs text-zinc-600">{formatDate(flight.departureTime)}</span>
        </div>
      </div>

      {/* Price */}
      {priceStr && (
        <div className="shrink-0 text-right">
          <span className="text-sm font-semibold text-emerald-400">{priceStr}</span>
        </div>
      )}

      {/* Book button */}
      {flight.bookingUrl ? (
        <a
          href={flight.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-amber-400 active:scale-95"
        >
          Book
        </a>
      ) : (
        <span className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-500">
          Book
        </span>
      )}
    </div>
  );
}
