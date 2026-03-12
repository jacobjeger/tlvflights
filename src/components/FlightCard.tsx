'use client';

import { Flight } from '@/lib/types';

interface FlightCardProps {
  flight: Flight;
  isLast?: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IL', {
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
  if (d.toDateString() === tomorrow.toDateString()) return 'Tmrw';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatPrice(price?: number, currency?: string): string | null {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency || 'USD'} ${price}`;
  }
}

function isStale(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() > 30 * 60 * 1000;
}

function getAirlineColor(code: string): string {
  const colors: Record<string, string> = {
    LY: 'bg-[#003f87]', IZ: 'bg-[#e97c00]', '6H': 'bg-[#00a651]', E2: 'bg-[#0d9488]',
  };
  return colors[code] || 'bg-zinc-600';
}

function getSeatsBadge(seats?: number): { text: string; cls: string } | null {
  if (seats == null) return null;
  if (seats === 0) return { text: 'Sold out', cls: 'text-red-400 bg-red-400/10' };
  if (seats < 5) return { text: `${seats} left!`, cls: 'text-amber-400 bg-amber-400/10' };
  if (seats < 10) return { text: `${seats} left`, cls: 'text-amber-400 bg-amber-400/10' };
  return { text: 'Available', cls: 'text-emerald-400 bg-emerald-400/10' };
}

function isDepartingSoon(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 3 * 60 * 60 * 1000;
}

export default function FlightCard({ flight, isLast }: FlightCardProps) {
  const stale = isStale(flight.lastSeen);
  const seatsBadge = getSeatsBadge(flight.seatsAvailable);
  const priceStr = formatPrice(flight.price, flight.currency);
  const soon = isDepartingSoon(flight.departureTime);

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-zinc-800/20 ${
        !isLast ? 'border-b border-zinc-800/30' : ''
      } ${stale ? 'opacity-30' : ''}`}
    >
      {/* Airline bar */}
      <div className={`h-7 w-1 shrink-0 rounded-full ${getAirlineColor(flight.airline)}`} title={flight.airlineName} />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-400">{flight.airlineName}</span>
          {flight.flightNumber && (
            <span className="mono text-[10px] text-zinc-600">{flight.flightNumber}</span>
          )}
          {seatsBadge && (
            <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${seatsBadge.cls}`}>
              {seatsBadge.text}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`mono text-sm font-bold ${soon ? 'text-amber-400' : 'text-zinc-200'}`}>
            {formatTime(flight.departureTime)}
          </span>
          <span className="text-[10px] text-zinc-600">{formatDate(flight.departureTime)}</span>
          {stale && <span className="text-[9px] text-amber-700">stale</span>}
        </div>
      </div>

      {/* Price */}
      {priceStr && (
        <span className="shrink-0 text-xs font-semibold text-emerald-400">{priceStr}</span>
      )}

      {/* Book */}
      {flight.bookingUrl ? (
        <a
          href={flight.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-black transition-all hover:bg-amber-400 active:scale-95"
        >
          Book
        </a>
      ) : (
        <span className="shrink-0 rounded-lg bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-600">
          Book
        </span>
      )}
    </div>
  );
}
