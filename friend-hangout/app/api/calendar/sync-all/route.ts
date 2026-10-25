import { NextRequest, NextResponse } from 'next/server';
import {
  syncGoogleCalendarForFriend,
  applyCalendarSyncToFriend,
} from '@/lib/googleCalendar';
import { updateFriendSubmission } from '@/lib/db';
import { calculateAvailabilityOverlap } from '@/lib/planner';
import type { Friend } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      hangoutId?: string;
      friends: Friend[];
      date: string;
      timePreference?: 'afternoon' | 'evening' | 'all-day' | 'night';
    };

    if (!body.friends || !Array.isArray(body.friends) || body.friends.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty friends array' },
        { status: 400 }
      );
    }

    const date = body.date || '2026-10-26';
    const timePref = body.timePreference || 'afternoon';
    const hangoutId = body.hangoutId || 'txmates-demo';

    const results = [];
    const updatedFriends: Friend[] = [];

    for (const friend of body.friends) {
      const syncResult = await syncGoogleCalendarForFriend(friend, date, {
        mode: 'auto',
        timePreference: timePref,
      });

      results.push(syncResult);
      const updated = applyCalendarSyncToFriend(friend, syncResult);
      updatedFriends.push(updated);

      // Persist each updated friend into SQLite
      try {
        updateFriendSubmission(hangoutId, updated.id, {
          friendName: updated.name,
          startTime: syncResult.suggestedStartTime,
          endTime: syncResult.suggestedEndTime,
          budgetPreference: updated.budgetPreference,
          topInterests: updated.topInterests,
          calendarSynced: true,
          calendarSyncDetails: updated.calendarSyncDetails,
        });
      } catch (dbErr) {
        console.warn(`Could not persist synced friend ${updated.id} to db:`, dbErr);
      }
    }

    const overlap = calculateAvailabilityOverlap(updatedFriends);

    const summary = `Auto-synced Google Calendars for all ${updatedFriends.length} mates. Shared group window: ${overlap.commonStart} to ${overlap.commonEnd} (${overlap.overlapHours} hrs).`;

    return NextResponse.json({
      success: true,
      summary,
      updatedFriends,
      results,
      overlap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to batch sync calendars';
    console.error('Error in /api/calendar/sync-all:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
