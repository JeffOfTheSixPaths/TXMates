import { NextRequest, NextResponse } from 'next/server';
import { syncGoogleCalendarForFriend } from '@/lib/googleCalendar';
import type { Friend } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      friend: Friend;
      date: string;
      mode?: 'auto' | 'ical' | 'upload' | 'demo';
      icsContent?: string;
      icalUrl?: string;
      timePreference?: 'afternoon' | 'evening' | 'all-day' | 'night';
    };

    if (!body.friend || !body.date) {
      return NextResponse.json(
        { error: 'Missing required parameters (friend, date)' },
        { status: 400 }
      );
    }

    const result = await syncGoogleCalendarForFriend(body.friend, body.date, {
      mode: body.mode || 'auto',
      icsContent: body.icsContent,
      icalUrl: body.icalUrl,
      timePreference: body.timePreference || 'afternoon',
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to import Google Calendar';
    console.error('Error in /api/calendar/import:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
