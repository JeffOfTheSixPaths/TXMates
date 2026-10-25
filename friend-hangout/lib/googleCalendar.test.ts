import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  minutesToTimeString,
  timeStringToMinutes,
  formatFriendlyTime,
  computeFreeWindows,
  parseIcsCalendar,
  getDemoGoogleCalendarEvents,
  generateIcsFeed,
  syncGoogleCalendarForFriend,
  applyCalendarSyncToFriend,
} from './googleCalendar';
import type { Friend, CalendarBusyEvent } from '@/types';

describe('Google Calendar utilities', () => {
  it('converts between minutes and time strings accurately', () => {
    assert.equal(minutesToTimeString(870), '14:30');
    assert.equal(minutesToTimeString(0), '00:00');
    assert.equal(minutesToTimeString(1439), '23:59');

    assert.equal(timeStringToMinutes('14:30'), 870);
    assert.equal(timeStringToMinutes('09:15'), 555);
    assert.equal(timeStringToMinutes('00:00'), 0);
  });

  it('formats friendly 12-hour time for display', () => {
    assert.equal(formatFriendlyTime('14:30'), '2:30 PM');
    assert.equal(formatFriendlyTime('09:15'), '9:15 AM');
    assert.equal(formatFriendlyTime('12:00'), '12:00 PM');
    assert.equal(formatFriendlyTime('00:30'), '12:30 AM');
    assert.equal(formatFriendlyTime('2:30 PM'), '2:30 PM'); // idempotent
  });

  it('computes free windows by inverting busy events and merging overlaps', () => {
    const busyEvents: CalendarBusyEvent[] = [
      { summary: 'Morning Standup', startTime: '09:30', endTime: '11:00' },
      { summary: 'Design Review', startTime: '10:30', endTime: '12:00' }, // Overlaps first
      { summary: 'Lunch & 1:1', startTime: '12:30', endTime: '13:45' },
      { summary: 'Evening Gym', startTime: '21:00', endTime: '22:30' },
    ];

    const { freeWindows, primaryWindow } = computeFreeWindows(
      busyEvents,
      { start: '09:00', end: '23:00' },
      'afternoon'
    );

    // Free windows should exist between 13:45 and 21:00
    assert.ok(freeWindows.length > 0);
    const mainAfternoon = freeWindows.find(
      (w) => w.startTime === '13:45' && w.endTime === '21:00'
    );
    assert.ok(mainAfternoon, 'Expected free window from 13:45 to 21:00');
    assert.equal(mainAfternoon.durationMinutes, 435);

    // Primary window should choose the afternoon slot
    assert.equal(primaryWindow.startTime, '13:45');
    assert.equal(primaryWindow.endTime, '21:00');
  });

  it('parses RFC 5545 iCalendar content with folded lines and filters target date', () => {
    const targetDate = '2026-10-26';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
      'BEGIN:VEVENT',
      'DTSTART:20261026T100000Z',
      'DTEND:20261026T113000Z',
      'SUMMARY:Project Sprint Review with',
      '  Cross-Functional Team',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20261026T120000Z',
      'DTEND:20261026T131500Z',
      'SUMMARY:Lunch with Mentor',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20261027T100000Z', // Different date - should be excluded
      'DTEND:20261027T110000Z',
      'SUMMARY:Next Day Meeting',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsed = parseIcsCalendar(icsContent, targetDate);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].summary, 'Project Sprint Review with Cross-Functional Team');
    assert.equal(parsed[0].startTime, '10:00');
    assert.equal(parsed[0].endTime, '11:30');

    assert.equal(parsed[1].summary, 'Lunch with Mentor');
    assert.equal(parsed[1].startTime, '12:00');
    assert.equal(parsed[1].endTime, '13:15');
  });

  it('ignores cancelled and transparent (free) calendar events', () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART:20261026T140000Z',
      'DTEND:20261026T150000Z',
      'SUMMARY:Cancelled Doctor Appointment',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20261026T160000Z',
      'DTEND:20261026T170000Z',
      'SUMMARY:Optional Webinar Reminder',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsed = parseIcsCalendar(icsContent, '2026-10-26');
    assert.equal(parsed.length, 0);
  });

  it('generates demo Google Calendars for Nessie friends', () => {
    const marcusEvents = getDemoGoogleCalendarEvents('Marcus W. (Organizer)', '2026-10-26');
    assert.ok(marcusEvents.length >= 2);
    assert.equal(marcusEvents[0].startTime, '09:15');

    const priyaEvents = getDemoGoogleCalendarEvents('Priya R.', '2026-10-26');
    assert.ok(priyaEvents.length >= 2);

    const elenaEvents = getDemoGoogleCalendarEvents('Elena M.', '2026-10-26');
    assert.ok(elenaEvents.length >= 2);
  });

  it('generates valid iCalendar feed that round-trips through parseIcsCalendar', () => {
    const events: CalendarBusyEvent[] = [
      { summary: 'Client Presentation', startTime: '10:00', endTime: '11:30' },
      { summary: 'Team Sync', startTime: '12:30', endTime: '13:30' },
    ];

    const feed = generateIcsFeed('Elena M.', events, '2026-10-26');
    assert.ok(feed.includes('BEGIN:VCALENDAR'));
    assert.ok(feed.includes('SUMMARY:Client Presentation'));

    const parsed = parseIcsCalendar(feed, '2026-10-26');
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].summary, 'Client Presentation');
    assert.equal(parsed[0].startTime, '10:00');
    assert.equal(parsed[0].endTime, '11:30');
  });

  it('syncs Google Calendar for a friend and updates their availability slot', async () => {
    const friend: Friend = {
      id: 'f-2',
      name: 'Priya R.',
      avatarColor: 'bg-purple-600 text-white',
      availabilitySlots: [{ id: 's-2', startTime: '12:00', endTime: '16:00' }],
      topInterests: ['arts', 'chill'],
    };

    const syncResult = await syncGoogleCalendarForFriend(friend, '2026-10-26', {
      mode: 'auto',
      timePreference: 'afternoon',
    });

    assert.equal(syncResult.success, true);
    assert.ok(syncResult.busyEvents.length > 0);
    assert.ok(syncResult.suggestedStartTime);
    assert.ok(syncResult.suggestedEndTime);

    const updatedFriend = applyCalendarSyncToFriend(friend, syncResult);
    assert.equal(updatedFriend.calendarSynced, true);
    assert.equal(updatedFriend.status, 'submitted');
    assert.equal(updatedFriend.availabilitySlots[0].startTime, syncResult.suggestedStartTime);
    assert.equal(updatedFriend.availabilitySlots[0].endTime, syncResult.suggestedEndTime);
    assert.ok(updatedFriend.calendarSyncDetails);
    assert.equal(updatedFriend.calendarSyncDetails.eventsDetected, syncResult.busyEvents.length);
  });
});
