import type { Friend, CalendarBusyEvent, FreeWindow, FriendCalendarSyncDetails } from '@/types';

export interface CalendarSyncResult {
  success: boolean;
  friendId?: string;
  friendName?: string;
  date: string;
  source: 'google' | 'ical' | 'upload' | 'demo';
  busyEvents: CalendarBusyEvent[];
  freeWindows: FreeWindow[];
  suggestedStartTime: string;
  suggestedEndTime: string;
  summaryNotice: string;
  error?: string;
}

/**
 * Format minutes since midnight into "HH:mm" 24-hour time string
 */
export function minutesToTimeString(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Convert "HH:mm" time string into minutes since midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Format 24h "HH:mm" into friendly 12h time (e.g. "14:30" -> "2:30 PM")
 */
export function formatFriendlyTime(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  if (!timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const period = (h || 0) >= 12 ? 'PM' : 'AM';
  const displayHour = (h || 0) % 12 === 0 ? 12 : (h || 0) % 12;
  const displayMin = (m || 0).toString().padStart(2, '0');
  return `${displayHour}:${displayMin} ${period}`;
}

/**
 * Computes available free windows by inverting busy events within the day boundary
 */
export function computeFreeWindows(
  busyEvents: CalendarBusyEvent[],
  bounds = { start: '09:00', end: '23:00' },
  timePreference: 'afternoon' | 'evening' | 'all-day' | 'night' = 'afternoon'
): { freeWindows: FreeWindow[]; primaryWindow: FreeWindow } {
  const dayStartMin = timeStringToMinutes(bounds.start);
  const dayEndMin = timeStringToMinutes(bounds.end);

  // If no busy events, whole day is free
  if (!busyEvents || busyEvents.length === 0) {
    let defStart = '11:00';
    let defEnd = '22:00';
    if (timePreference === 'afternoon') {
      defStart = '12:00';
      defEnd = '18:00';
    } else if (timePreference === 'evening') {
      defStart = '17:00';
      defEnd = '22:30';
    } else if (timePreference === 'night') {
      defStart = '19:00';
      defEnd = '23:00';
    }

    const window: FreeWindow = {
      startTime: defStart,
      endTime: defEnd,
      durationMinutes: timeStringToMinutes(defEnd) - timeStringToMinutes(defStart),
    };
    return { freeWindows: [window], primaryWindow: window };
  }

  // Convert busy events to [start, end] minutes, bounded inside day bounds
  const rawIntervals: Array<[number, number]> = [];
  for (const event of busyEvents) {
    if (event.isAllDay) {
      rawIntervals.push([dayStartMin, dayEndMin]);
      continue;
    }
    const start = Math.max(dayStartMin, timeStringToMinutes(event.startTime));
    const end = Math.min(dayEndMin, timeStringToMinutes(event.endTime));
    if (end > start) {
      rawIntervals.push([start, end]);
    }
  }

  // Sort intervals by start time
  rawIntervals.sort((a, b) => a[0] - b[0]);

  // Merge overlapping or adjoining intervals
  const mergedBusy: Array<[number, number]> = [];
  for (const interval of rawIntervals) {
    if (mergedBusy.length === 0) {
      mergedBusy.push(interval);
    } else {
      const prev = mergedBusy[mergedBusy.length - 1];
      if (interval[0] <= prev[1]) {
        prev[1] = Math.max(prev[1], interval[1]);
      } else {
        mergedBusy.push(interval);
      }
    }
  }

  // Complement: compute free gaps
  const freeGaps: FreeWindow[] = [];
  let currentCursor = dayStartMin;

  for (const [busyStart, busyEnd] of mergedBusy) {
    if (busyStart > currentCursor) {
      const duration = busyStart - currentCursor;
      if (duration >= 45) {
        // At least 45 minutes
        freeGaps.push({
          startTime: minutesToTimeString(currentCursor),
          endTime: minutesToTimeString(busyStart),
          durationMinutes: duration,
        });
      }
    }
    currentCursor = Math.max(currentCursor, busyEnd);
  }

  if (dayEndMin > currentCursor) {
    const duration = dayEndMin - currentCursor;
    if (duration >= 45) {
      freeGaps.push({
        startTime: minutesToTimeString(currentCursor),
        endTime: minutesToTimeString(dayEndMin),
        durationMinutes: duration,
      });
    }
  }

  // Fallback if day is completely packed
  if (freeGaps.length === 0) {
    const fallback: FreeWindow = {
      startTime: '18:00',
      endTime: '21:00',
      durationMinutes: 180,
    };
    return { freeWindows: [fallback], primaryWindow: fallback };
  }

  // Score each free window according to timePreference & duration
  const targetPrefHours: Record<string, { start: number; end: number }> = {
    afternoon: { start: 12 * 60, end: 17 * 60 },
    evening: { start: 17 * 60, end: 21 * 60 },
    night: { start: 19 * 60, end: 23 * 60 },
    'all-day': { start: 11 * 60, end: 22 * 60 },
  };

  const pref = targetPrefHours[timePreference] || targetPrefHours.afternoon;

  let bestWindow = freeGaps[0];
  let bestScore = -Infinity;

  for (const gap of freeGaps) {
    const gapStart = timeStringToMinutes(gap.startTime);
    const gapEnd = timeStringToMinutes(gap.endTime);

    // Overlap with user's preferred time of day
    const overlapStart = Math.max(gapStart, pref.start);
    const overlapEnd = Math.min(gapEnd, pref.end);
    const prefOverlapMin = Math.max(0, overlapEnd - overlapStart);

    // Score combines preference overlap and total length (weight overlap higher)
    const score = prefOverlapMin * 2 + gap.durationMinutes;

    if (score > bestScore) {
      bestScore = score;
      bestWindow = gap;
    }
  }

  return { freeWindows: freeGaps, primaryWindow: bestWindow };
}

/**
 * Parses standard iCalendar (.ics) RFC 5545 string and extracts busy events for targetDateIso
 */
export function parseIcsCalendar(icsContent: string, targetDateIso: string): CalendarBusyEvent[] {
  if (!icsContent || !icsContent.includes('BEGIN:VCALENDAR')) {
    return [];
  }

  // RFC 5545 line unfolding: merge lines beginning with space or tab
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  // Normalize target date: "2026-10-26" -> "20261026"
  const targetDateClean = targetDateIso.replace(/-/g, '');

  const events: CalendarBusyEvent[] = [];
  let inEvent = false;
  let summary = 'Busy';
  let dtstart = '';
  let dtend = '';
  let isAllDay = false;
  let status = 'CONFIRMED';
  let transp = 'OPAQUE'; // OPAQUE means busy; TRANSPARENT means free/available

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = 'Busy';
      dtstart = '';
      dtend = '';
      isAllDay = false;
      status = 'CONFIRMED';
      transp = 'OPAQUE';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && status !== 'CANCELLED' && transp !== 'TRANSPARENT') {
        const parsed = processIcsEvent(summary, dtstart, dtend, isAllDay, targetDateClean);
        if (parsed) {
          events.push(parsed);
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = trimmed.slice(0, colonIdx).toUpperCase();
    const valPart = trimmed.slice(colonIdx + 1).trim();

    if (keyPart === 'SUMMARY') {
      summary = valPart || 'Busy Event';
    } else if (keyPart.startsWith('DTSTART')) {
      dtstart = valPart;
      if (keyPart.includes('VALUE=DATE')) {
        isAllDay = true;
      }
    } else if (keyPart.startsWith('DTEND')) {
      dtend = valPart;
      if (keyPart.includes('VALUE=DATE')) {
        isAllDay = true;
      }
    } else if (keyPart === 'STATUS') {
      status = valPart.toUpperCase();
    } else if (keyPart === 'TRANSP') {
      transp = valPart.toUpperCase();
    }
  }

  // Sort events chronologically
  events.sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));
  return events;
}

function processIcsEvent(
  summary: string,
  dtstart: string,
  dtend: string,
  isAllDay: boolean,
  targetDateClean: string
): CalendarBusyEvent | null {
  if (!dtstart) return null;

  // Extract date part: "20261026T143000Z" -> "20261026"
  const startDatePart = dtstart.slice(0, 8);
  const endDatePart = dtend ? dtend.slice(0, 8) : startDatePart;

  // Check if target date falls within this event
  const isTargetDay =
    startDatePart === targetDateClean ||
    (startDatePart <= targetDateClean && endDatePart >= targetDateClean);

  if (!isTargetDay) return null;

  if (isAllDay || dtstart.length === 8) {
    return {
      summary: summary || 'All-day commitment',
      startTime: '09:00',
      endTime: '23:00',
      isAllDay: true,
    };
  }

  // Extract time parts (HHMMSS)
  // Format: "20261026T143000" or "20261026T143000Z"
  const timeStartMatch = dtstart.match(/T(\d{2})(\d{2})/);
  if (!timeStartMatch) return null;

  const startH = timeStartMatch[1];
  const startM = timeStartMatch[2];
  const startTime = `${startH}:${startM}`;

  let endTime = '22:00';
  if (dtend) {
    const timeEndMatch = dtend.match(/T(\d{2})(\d{2})/);
    if (timeEndMatch) {
      endTime = `${timeEndMatch[1]}:${timeEndMatch[2]}`;
    }
  } else {
    // Default 1 hour duration if no end time
    const sMin = timeStringToMinutes(startTime);
    endTime = minutesToTimeString(sMin + 60);
  }

  // If start is after end due to midnight crossing, clamp
  if (timeStringToMinutes(endTime) <= timeStringToMinutes(startTime)) {
    endTime = '23:00';
  }

  return {
    summary: summary || 'Busy event',
    startTime,
    endTime,
    isAllDay: false,
  };
}

/**
 * Realistic calendar schedules for the Nessie squad demo members and custom friends
 */
export function getDemoGoogleCalendarEvents(
  friendIdOrName: string,
  targetDateIso?: string
): CalendarBusyEvent[] {
  const norm = friendIdOrName.toLowerCase();
  const date = targetDateIso || '2026-10-26';

  if (norm.includes('marcus') || norm === 'f-1') {
    return [
      {
        summary: 'Sprint Planning & Tech Architecture (Google Meet)',
        startTime: '09:15',
        endTime: '10:45',
        date,
      },
      {
        summary: 'Client Deliverable Sync & Lunch',
        startTime: '11:15',
        endTime: '12:45',
        date,
      },
      {
        summary: 'Family Video Check-in',
        startTime: '21:30',
        endTime: '22:30',
        date,
      },
    ];
  }

  if (norm.includes('priya') || norm === 'f-2') {
    return [
      {
        summary: 'UX Design Review & Prototyping Workshop',
        startTime: '09:30',
        endTime: '11:30',
        date,
      },
      {
        summary: 'Design Team Lunch & 1:1 Sync',
        startTime: '12:00',
        endTime: '13:45',
        date,
      },
      {
        summary: 'Austin Ceramics Studio Open Hours',
        startTime: '21:00',
        endTime: '22:15',
        date,
      },
    ];
  }

  if (norm.includes('tyler') || norm === 'f-3') {
    return [
      {
        summary: 'Biomedical Lab Practicum & Field Work',
        startTime: '08:30',
        endTime: '11:30',
        date,
      },
      {
        summary: 'Graduate Study Cohort & Lab Wrap-up',
        startTime: '12:30',
        endTime: '14:30',
        date,
      },
      {
        summary: 'Late Night Coding & Gaming Stream',
        startTime: '22:30',
        endTime: '23:30',
        date,
      },
    ];
  }

  if (norm.includes('elena') || norm === 'f-4') {
    return [
      {
        summary: 'Greenbelt Conservancy Volunteer Walk',
        startTime: '10:00',
        endTime: '11:30',
        date,
      },
      {
        summary: 'Nonprofit Board Strategy Call',
        startTime: '12:15',
        endTime: '13:30',
        date,
      },
      {
        summary: 'Austin Book Club Monthly Meeting',
        startTime: '21:45',
        endTime: '22:45',
        date,
      },
    ];
  }

  // Deterministic schedule for any other friend
  let hash = 0;
  for (let i = 0; i < friendIdOrName.length; i++) {
    hash = (hash << 5) - hash + friendIdOrName.charCodeAt(i);
    hash |= 0;
  }
  const morningH = 9 + (Math.abs(hash) % 2); // 9 or 10
  const lunchH = 12 + (Math.abs(hash >> 2) % 2); // 12 or 13

  return [
    {
      summary: 'Morning Work Standup & Meetings',
      startTime: `${morningH.toString().padStart(2, '0')}:00`,
      endTime: `${(morningH + 1).toString().padStart(2, '0')}:30`,
      date,
    },
    {
      summary: 'Team Lunch & Planning',
      startTime: `${lunchH.toString().padStart(2, '0')}:00`,
      endTime: `${(lunchH + 1).toString().padStart(2, '0')}:15`,
      date,
    },
  ];
}

/**
 * Creates a valid RFC 5545 iCalendar string representing a person's schedule
 */
export function generateIcsFeed(
  friendName: string,
  busyEvents: CalendarBusyEvent[],
  targetDateIso: string
): string {
  const dateCompact = targetDateIso.replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Google Inc//Google Calendar 70.9054//EN`,
    `X-WR-CALNAME:${friendName} Google Calendar`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  busyEvents.forEach((ev, idx) => {
    const sH = ev.startTime.replace(':', '') + '00';
    const eH = ev.endTime.replace(':', '') + '00';
    lines.push(
      'BEGIN:VEVENT',
      `UID:txmates-evt-${idx}-${dateCompact}@google.com`,
      `DTSTAMP:${dateCompact}T000000Z`,
      `DTSTART:${dateCompact}T${sH}`,
      `DTEND:${dateCompact}T${eH}`,
      `SUMMARY:${ev.summary}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Sync Google Calendar availability for an individual friend
 */
export async function syncGoogleCalendarForFriend(
  friend: Friend,
  date: string,
  options: {
    mode?: 'auto' | 'ical' | 'upload' | 'demo';
    icsContent?: string;
    icalUrl?: string;
    timePreference?: 'afternoon' | 'evening' | 'all-day' | 'night';
  } = {}
): Promise<CalendarSyncResult> {
  const mode = options.mode || 'auto';
  let busyEvents: CalendarBusyEvent[] = [];
  let source: CalendarSyncResult['source'] = 'google';

  if (mode === 'upload' && options.icsContent) {
    busyEvents = parseIcsCalendar(options.icsContent, date);
    source = 'upload';
  } else if (mode === 'ical' && options.icalUrl) {
    try {
      const res = await fetch(options.icalUrl, {
        headers: { 'User-Agent': 'TXMates-CalendarSync/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        throw new Error(`Calendar URL responded with HTTP ${res.status}`);
      }
      const icsText = await res.text();
      busyEvents = parseIcsCalendar(icsText, date);
      source = 'ical';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch calendar';
      return {
        success: false,
        friendId: friend.id,
        friendName: friend.name,
        date,
        source: 'ical',
        busyEvents: [],
        freeWindows: [],
        suggestedStartTime: friend.availabilitySlots[0]?.startTime || '14:00',
        suggestedEndTime: friend.availabilitySlots[0]?.endTime || '20:00',
        summaryNotice: `Could not fetch iCal feed: ${message}`,
        error: message,
      };
    }
  } else {
    // 1-Click Auto / Demo sync
    busyEvents = getDemoGoogleCalendarEvents(friend.name || friend.id, date);
    source = 'demo';
  }

  const { freeWindows, primaryWindow } = computeFreeWindows(
    busyEvents,
    { start: '09:00', end: '23:00' },
    options.timePreference || 'afternoon'
  );

  const summaryNotice =
    busyEvents.length > 0
      ? `Imported ${busyEvents.length} calendar event${busyEvents.length === 1 ? '' : 's'}. Free from ${formatFriendlyTime(primaryWindow.startTime)} to ${formatFriendlyTime(primaryWindow.endTime)}.`
      : `No conflicting events on ${date}. Free all afternoon (${formatFriendlyTime(primaryWindow.startTime)} - ${formatFriendlyTime(primaryWindow.endTime)}).`;

  return {
    success: true,
    friendId: friend.id,
    friendName: friend.name,
    date,
    source,
    busyEvents,
    freeWindows,
    suggestedStartTime: primaryWindow.startTime,
    suggestedEndTime: primaryWindow.endTime,
    summaryNotice,
  };
}

/**
 * Apply a sync result to a friend object, updating their slot and sync details
 */
export function applyCalendarSyncToFriend(
  friend: Friend,
  result: CalendarSyncResult
): Friend {
  const syncDetails: FriendCalendarSyncDetails = {
    source: result.source,
    syncedAt: new Date().toISOString(),
    eventsDetected: result.busyEvents.length,
    busyEvents: result.busyEvents,
    freeWindows: result.freeWindows,
    suggestedStart: result.suggestedStartTime,
    suggestedEnd: result.suggestedEndTime,
  };

  return {
    ...friend,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    calendarSynced: true,
    calendarSyncDetails: syncDetails,
    availabilitySlots: [
      {
        id: friend.availabilitySlots[0]?.id || `slot-${friend.id}`,
        startTime: result.suggestedStartTime,
        endTime: result.suggestedEndTime,
        label: `${formatFriendlyTime(result.suggestedStartTime)} - ${formatFriendlyTime(result.suggestedEndTime)} (Google Calendar)`,
      },
    ],
  };
}
