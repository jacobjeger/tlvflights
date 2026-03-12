import { NextRequest, NextResponse } from 'next/server';
import { getFlights, getLastSync } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin') || undefined;
    const date = searchParams.get('date') || undefined;
    const airline = searchParams.get('airline') || undefined;

    let flights = getFlights(origin, date);

    if (airline) {
      flights = flights.filter((f) => f.airline === airline);
    }

    const lastSync = getLastSync();

    return NextResponse.json({
      flights,
      lastSync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    return NextResponse.json(
      { flights: [], lastSync: null, timestamp: new Date().toISOString(), error: 'Failed to fetch flights' },
      { status: 500 }
    );
  }
}
