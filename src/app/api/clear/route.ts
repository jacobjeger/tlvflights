import { NextResponse } from 'next/server';
import { clearAllFlights } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const removed = await clearAllFlights();
    return NextResponse.json({
      success: true,
      message: `Cleared ${removed} flights from database`,
      removed,
    });
  } catch (error) {
    console.error('Error clearing flights:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear flights' },
      { status: 500 }
    );
  }
}
