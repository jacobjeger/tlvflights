import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TLV Flights — Find a Seat Out',
  description: 'Real-time flight availability from Ben Gurion (TLV) and Taba airports. Find any available seat to any destination.',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-5xl px-4 py-4 sm:py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
