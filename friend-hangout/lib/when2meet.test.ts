import test from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import {
  formatHourLabel,
  formatHourShort,
  isHourInSlot,
  slotsToHourGrid,
  hourGridToSlots,
  computeWhen2MeetMatrix,
} from './when2meet';
import { initHangoutDb, listHangoutsFromDb, createNewHangout, getHangoutFromDb } from './db';
import type { Friend, TimeSlot } from '@/types';

test('formatHourLabel formats 12-hour clock labels correctly', () => {
  assert.strictEqual(formatHourLabel(8), '8:00 AM');
  assert.strictEqual(formatHourLabel(12), '12:00 PM');
  assert.strictEqual(formatHourLabel(13), '1:00 PM');
  assert.strictEqual(formatHourLabel(23), '11:00 PM');
});

test('formatHourShort formats compact hour strings correctly', () => {
  assert.strictEqual(formatHourShort(8), '8a');
  assert.strictEqual(formatHourShort(12), '12p');
  assert.strictEqual(formatHourShort(13), '1p');
  assert.strictEqual(formatHourShort(21), '9p');
});

test('isHourInSlot correctly determines hour overlap', () => {
  // Slot 13:00 to 17:00 covers 13, 14, 15, 16. Hour 17 is outside. Hour 12 is outside.
  assert.strictEqual(isHourInSlot(12, '13:00', '17:00'), false);
  assert.strictEqual(isHourInSlot(13, '13:00', '17:00'), true);
  assert.strictEqual(isHourInSlot(14, '13:00', '17:00'), true);
  assert.strictEqual(isHourInSlot(16, '13:00', '17:00'), true);
  assert.strictEqual(isHourInSlot(17, '13:00', '17:00'), false);

  // Slot with minute ending: 13:00 to 17:30 also covers hour 17 (17:00 - 17:30)
  assert.strictEqual(isHourInSlot(17, '13:00', '17:30'), true);
  assert.strictEqual(isHourInSlot(18, '13:00', '17:30'), false);
});

test('slotsToHourGrid and hourGridToSlots roundtrip converts and merges blocks', () => {
  const dates = ['2026-10-26'];
  const slots: TimeSlot[] = [
    { id: '1', startTime: '13:00', endTime: '15:00', date: '2026-10-26' },
    { id: '2', startTime: '18:00', endTime: '20:00', date: '2026-10-26' },
  ];

  const grid = slotsToHourGrid(slots, dates);
  assert.strictEqual(grid['2026-10-26'][12], false);
  assert.strictEqual(grid['2026-10-26'][13], true);
  assert.strictEqual(grid['2026-10-26'][14], true);
  assert.strictEqual(grid['2026-10-26'][15], false);
  assert.strictEqual(grid['2026-10-26'][18], true);
  assert.strictEqual(grid['2026-10-26'][19], true);
  assert.strictEqual(grid['2026-10-26'][20], false);

  const mergedSlots = hourGridToSlots(grid, dates);
  assert.strictEqual(mergedSlots.length, 2);
  assert.strictEqual(mergedSlots[0].startTime, '13:00');
  assert.strictEqual(mergedSlots[0].endTime, '15:00');
  assert.strictEqual(mergedSlots[1].startTime, '18:00');
  assert.strictEqual(mergedSlots[1].endTime, '20:00');
});

test('computeWhen2MeetMatrix aggregates multi-friend availability across dates', () => {
  const dates = ['2026-10-26', '2026-10-27'];
  const friends: Friend[] = [
    {
      id: 'f-1',
      name: 'Alice',
      avatarColor: 'bg-teal-600',
      availabilitySlots: [{ id: 's-1', startTime: '14:00', endTime: '18:00' }],
      budgetPreference: 30,
      topInterests: ['food'],
    },
    {
      id: 'f-2',
      name: 'Bob',
      avatarColor: 'bg-purple-600',
      availabilitySlots: [{ id: 's-2', startTime: '16:00', endTime: '20:00' }],
      budgetPreference: 40,
      topInterests: ['music'],
    },
  ];

  const matrix = computeWhen2MeetMatrix(dates, friends);

  // At 14:00 on 2026-10-26: Alice available, Bob unavailable (1/2)
  const cell14 = matrix['2026-10-26'][14];
  assert.strictEqual(cell14.availableCount, 1);
  assert.strictEqual(cell14.totalCount, 2);
  assert.strictEqual(cell14.ratio, 0.5);
  assert.deepStrictEqual(cell14.availableFriends, ['Alice']);
  assert.deepStrictEqual(cell14.unavailableFriends, ['Bob']);

  // At 16:00 on 2026-10-26: Both Alice and Bob available (2/2)
  const cell16 = matrix['2026-10-26'][16];
  assert.strictEqual(cell16.availableCount, 2);
  assert.strictEqual(cell16.totalCount, 2);
  assert.strictEqual(cell16.ratio, 1.0);
  assert.deepStrictEqual(cell16.availableFriends, ['Alice', 'Bob']);
  assert.deepStrictEqual(cell16.unavailableFriends, []);

  // At 21:00: Neither available (0/2)
  const cell21 = matrix['2026-10-26'][21];
  assert.strictEqual(cell21.availableCount, 0);
  assert.strictEqual(cell21.ratio, 0);
  assert.deepStrictEqual(cell21.unavailableFriends, ['Alice', 'Bob']);
});

test('multi-group database isolation and listing works with isolated SQLite', () => {
  const db = new DatabaseSync(':memory:');
  initHangoutDb(db);

  // Initially, default txmates-demo exists once listed
  const initialList = listHangoutsFromDb(db);
  assert.strictEqual(initialList.length, 1);
  assert.strictEqual(initialList[0].id, 'txmates-demo');

  // Create a separate hangout group
  const group2 = createNewHangout(
    { groupName: 'Saturday Runners', location: 'Lady Bird Lake, Austin', id: 'group-runners' },
    db
  );
  assert.strictEqual(group2.id, 'group-runners');
  assert.strictEqual(group2.groupName, 'Saturday Runners');

  // Verify list returns both groups
  const updatedList = listHangoutsFromDb(db);
  assert.strictEqual(updatedList.length, 2);
  const runnerSummary = updatedList.find((g) => g.id === 'group-runners');
  assert.ok(runnerSummary);
  assert.strictEqual(runnerSummary?.groupName, 'Saturday Runners');

  // Verify retrieval
  const fetched = getHangoutFromDb('group-runners', db);
  assert.strictEqual(fetched?.id, 'group-runners');
  assert.strictEqual(fetched?.groupName, 'Saturday Runners');
  assert.strictEqual(fetched?.location, 'Lady Bird Lake, Austin');
});
