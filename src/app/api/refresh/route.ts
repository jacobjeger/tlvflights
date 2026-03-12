import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // The sync module will be created separately at src/lib/sync.ts
    // Once available, uncomment the following:
    // const { runSync } = await import('@/lib/sync');
    // await runSync();

    return NextResponse.json({
      success: true,
      message: 'Sync triggered successfully',
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}
