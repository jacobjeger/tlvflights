import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { runSync } = await import('@/lib/sync');
    const result = await runSync();

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      flightsStored: result.total,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}
