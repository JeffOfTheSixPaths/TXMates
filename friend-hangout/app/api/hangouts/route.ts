import { NextRequest, NextResponse } from 'next/server';
import { saveHangoutToDb, getHangoutFromDb, getDb, listHangoutsFromDb, createNewHangout } from '@/lib/db';
import { parseItinerarySnapshot, readItineraryLock, writeItineraryLock } from '@/lib/itineraryLock';
import { HangoutPreferences } from '@/types';

function hangoutId(value: unknown): string {
  if (typeof value !== 'string') return 'txmates-demo';
  const trimmed = value.trim();
  if (!/^[\w-]{1,80}$/.test(trimmed)) return 'txmates-demo';
  return trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && body.action === 'create') {
      const created = createNewHangout({
        groupName: typeof body.groupName === 'string' ? body.groupName : undefined,
        location: typeof body.location === 'string' ? body.location : undefined,
        id: typeof body.id === 'string' ? body.id : undefined,
      });
      return NextResponse.json({ success: true, id: created.id, hangout: created });
    }

    const data = body as HangoutPreferences;
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
    if (searchParams.get('list') === 'true') {
      const hangouts = listHangoutsFromDb();
      return NextResponse.json({ hangouts });
    }

    const id = searchParams.get('id') || 'txmates-demo';
    const hangout = getHangoutFromDb(id);
    if (!hangout) {
      return NextResponse.json({ error: 'Hangout not found' }, { status: 404 });
    }
    return NextResponse.json({ hangout, itineraryLock: readItineraryLock(getDb(), id) });
  } catch (err: unknown) {
    console.error('Error fetching hangout from SQL:', err);
    return NextResponse.json(
      { error: 'Failed to fetch hangout' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: unknown; locked?: unknown; itinerary?: unknown };
    const id = hangoutId(body.id);
    const locked = body.locked === true;
    const snapshot = parseItinerarySnapshot(body.itinerary);
    if (locked && !snapshot) {
      return NextResponse.json({ error: 'A locked itinerary needs its stops.' }, { status: 400 });
    }
    getHangoutFromDb(id);
    try {
      const itineraryLock = writeItineraryLock(getDb(), id, locked, snapshot);
      return NextResponse.json({ success: true, itineraryLock });
    } catch {
      return NextResponse.json({ error: 'Hangout not found' }, { status: 404 });
    }
  } catch (err: unknown) {
    console.error('Error saving itinerary lock:', err);
    return NextResponse.json({ error: 'Failed to save itinerary lock' }, { status: 500 });
  }
}
