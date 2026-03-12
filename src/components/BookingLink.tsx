'use client';

interface BookingLinkProps {
  bookingUrl?: string;
  airlineName: string;
}

export default function BookingLink({ bookingUrl, airlineName }: BookingLinkProps) {
  if (!bookingUrl) {
    return (
      <span className="inline-block rounded-md bg-neutral-700/50 px-3 py-2 text-xs text-neutral-400">
        Visit {airlineName}
      </span>
    );
  }

  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      Book
    </a>
  );
}
