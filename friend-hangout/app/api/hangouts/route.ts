import { NextRequest, NextResponse } from 'next/server';
import { saveHangoutToDb, getHangoutFromDb } from '@/lib/db';
import { HangoutPreferences } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as HangoutPreferences;
    const id = saveHangoutToDb(data);
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    console.error('Error saving hangout to SQL:', err);
    return NextResponse.json(
      { error: 'Failed to save hangout to database' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || 'txmates-demo';
    const hangout = getHangoutFromDb(id);
    if (!hangout) {
      return NextResponse.json({ error: 'Hangout not found' }, { status: 404 });
    }
    return NextResponse.json({ hangout });
  } catch (err: unknown) {
    console.error('Error fetching hangout from SQL:', err);
    return NextResponse.json(
      { error: 'Failed to fetch hangout' },
      { status: 500 }
    );
  }
}
