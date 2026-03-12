import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'TLV Flights - Find Available Seats',
  description: 'Real-time flight availability from TLV and Taba airports',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${geistMono.variable} antialiased min-h-dvh bg-[#0a0a0a] text-neutral-100`}>
        <main className="mx-auto max-w-3xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
