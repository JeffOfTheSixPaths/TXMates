import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatFriendlyDate,
  compareCandidateDates,
  calculateAvailabilityOverlap,
} from './planner.ts';
import { coverageCount } from './availabilityHeat.ts';
import {
  saveHangoutToDb,
  getHangoutFromDb,
  updateFriendSubmission,
} from './db.ts';
import type { Friend, HangoutPreferences } from '../types/index.ts';

describe('Candidate Dates & Multi-Date Availability', () => {
  it('formats friendly date strings correctly', () => {
    assert.equal(formatFriendlyDate('2026-10-26'), 'Mon, Oct 26');
    assert.equal(formatFriendlyDate('2026-10-31'), 'Sat, Oct 31');
    assert.equal(formatFriendlyDate('invalid-date'), 'invalid-date');
  });

  it('compares candidate dates and identifies the best date', () => {
    const friends: Friend[] = [
      {
        id: 'f-1',
        name: 'Jordan',
        avatarColor: 'bg-teal-600',
        availabilitySlots: [
          { id: 's1-mon', startTime: '12:00', endTime: '18:00', date: '2026-10-26' },
          { id: 's1-sat', startTime: '14:00', endTime: '22:00', date: '2026-10-31' },
        ],
      },
      {
        id: 'f-2',
        name: 'Sam',
        avatarColor: 'bg-emerald-600',
        availabilitySlots: [
          // Sam is only free on Saturday
          { id: 's2-sat', startTime: '12:00', endTime: '20:00', date: '2026-10-31' },
        ],
      },
      {
        id: 'f-3',
        name: 'Taylor',
        avatarColor: 'bg-cyan-600',
        availabilitySlots: [
          { id: 's3-mon', startTime: '12:00', endTime: '16:00', date: '2026-10-26' },
          { id: 's3-sat', startTime: '13:00', endTime: '21:00', date: '2026-10-31' },
        ],
      },
    ];

    const summaries = compareCandidateDates(friends, ['2026-10-26', '2026-10-31']);

    assert.equal(summaries.length, 2);

    const mon = summaries.find((s) => s.date === '2026-10-26');
    const sat = summaries.find((s) => s.date === '2026-10-31');

    assert.ok(mon);
    assert.ok(sat);

    // Monday has 2 friends available (Jordan & Taylor)
    assert.equal(mon.availableCount, 2);
    assert.equal(mon.isBest, false);

    // Saturday has all 3 friends available
    assert.equal(sat.availableCount, 3);
    assert.equal(sat.isBest, true);
    assert.equal(sat.commonStart, '2:00 PM');
    assert.equal(sat.commonEnd, '8:00 PM');
    assert.equal(sat.overlapHours, 6);
  });

  it('calculateAvailabilityOverlap filters by target date', () => {
    const friends: Friend[] = [
      {
        id: 'f-1',
        name: 'Alex',
        avatarColor: 'bg-teal-600',
        availabilitySlots: [
          { id: 's1-fri', startTime: '18:00', endTime: '22:00', date: '2026-10-30' },
          { id: 's1-sat', startTime: '12:00', endTime: '18:00', date: '2026-10-31' },
        ],
      },
      {
        id: 'f-2',
        name: 'Morgan',
        avatarColor: 'bg-emerald-600',
        availabilitySlots: [
          { id: 's2-fri', startTime: '19:00', endTime: '23:00', date: '2026-10-30' },
          { id: 's2-sat', startTime: '13:00', endTime: '17:00', date: '2026-10-31' },
        ],
      },
    ];

    const friOverlap = calculateAvailabilityOverlap(friends, '2026-10-30');
    assert.equal(friOverlap.allFriendsAvailable, true);
    assert.equal(friOverlap.commonStart, '7:00 PM');
    assert.equal(friOverlap.commonEnd, '10:00 PM');
    assert.equal(friOverlap.overlapHours, 3);

    const satOverlap = calculateAvailabilityOverlap(friends, '2026-10-31');
    assert.equal(satOverlap.allFriendsAvailable, true);
    assert.equal(satOverlap.commonStart, '1:00 PM');
    assert.equal(satOverlap.commonEnd, '5:00 PM');
    assert.equal(satOverlap.overlapHours, 4);
  });

  it('coverageCount respects targetDate when calculating heat', () => {
    const friends: Friend[] = [
      {
        id: 'f-1',
        name: 'Jamie',
        avatarColor: 'bg-teal-600',
        availabilitySlots: [
          { id: 's1', startTime: '12:00', endTime: '17:00', date: '2026-10-26' },
          { id: 's2', startTime: '18:00', endTime: '22:00', date: '2026-10-27' },
        ],
      },
    ];

    // On 2026-10-26, Jamie is free 12:00-17:00
    const covDay1 = coverageCount(friends, '12:00', '17:00', '2026-10-26');
    assert.equal(covDay1.count, 1);

    const covDay1Evening = coverageCount(friends, '18:00', '22:00', '2026-10-26');
    assert.equal(covDay1Evening.count, 0);

    // On 2026-10-27, Jamie is free 18:00-22:00
    const covDay2 = coverageCount(friends, '18:00', '22:00', '2026-10-27');
    assert.equal(covDay2.count, 1);
  });

  it('persists selectedDates in hangouts table and slots_json in friend submissions', () => {
    const testHangoutId = `test-multidate-${Date.now()}`;
    const testPrefs: HangoutPreferences = {
      id: testHangoutId,
      groupName: 'Multi-Date Squad',
      friendCount: 2,
      location: 'Austin, TX',
      date: '2026-10-26',
      selectedDates: ['2026-10-26', '2026-10-27', '2026-10-31'],
      timePreference: 'afternoon',
      maxBudgetPerPerson: 40,
      selectedInterests: ['food', 'music'],
      friends: [
        {
          id: 'f-test-1',
          name: 'Person A',
          avatarColor: 'bg-teal-600',
          availabilitySlots: [{ id: 's-1', startTime: '12:00', endTime: '18:00' }],
        },
      ],
    };

    saveHangoutToDb(testPrefs);

    const retrieved = getHangoutFromDb(testHangoutId);
    assert.ok(retrieved);
    assert.equal(retrieved.date, '2026-10-26');
    assert.deepEqual(retrieved.selectedDates, ['2026-10-26', '2026-10-27', '2026-10-31']);

    // Now submit multi-date slots for Person A
    updateFriendSubmission(testHangoutId, 'f-test-1', {
      friendName: 'Person A',
      startTime: '13:00',
      endTime: '19:00',
      date: '2026-10-27',
      slots: [
        { startTime: '12:00', endTime: '18:00', date: '2026-10-26' },
        { startTime: '14:00', endTime: '20:00', date: '2026-10-27' },
        { startTime: '10:00', endTime: '16:00', date: '2026-10-31' },
      ],
      budgetPreference: 55,
      topInterests: ['food', 'outdoors'],
    });

    const afterUpdate = getHangoutFromDb(testHangoutId);
    assert.ok(afterUpdate);
    const updatedFriend = afterUpdate.friends.find((f) => f.id === 'f-test-1');
    assert.ok(updatedFriend);
    assert.equal(updatedFriend.availabilitySlots.length, 3);
    assert.equal(updatedFriend.availabilitySlots[1].date, '2026-10-27');
    assert.equal(updatedFriend.availabilitySlots[1].startTime, '14:00');
    assert.equal(updatedFriend.availabilitySlots[1].endTime, '20:00');
  });
});
