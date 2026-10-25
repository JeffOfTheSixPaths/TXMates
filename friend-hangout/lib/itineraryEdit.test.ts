import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Activity, HangoutPreferences, ItineraryItem } from '@/types';
import { parseSlotLabel, timeToMinutes } from './availabilityHeat.ts';
import {
  TRAVEL_BUFFER_MINUTES,
  editItinerary,
  eventBlocked,
  filterSwapCandidates,
  indexFromPointer,
  reorderItinerary,
  spendSummary,
  swapItineraryStop,
} from './itineraryEdit.ts';
import { itineraryImageFilename } from './itineraryPoster.ts';
import { buildItinerary } from './planner.ts';

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-a',
    name: 'Brisket porch',
    category: 'food',
    categoryLabel: 'Food & BBQ',
    location: '100 Congress Ave',
    neighborhood: 'Downtown Austin',
    estimatedCostPerPerson: 10,
    durationMinutes: 60,
    description: 'Brisket on a porch',
    highlights: ['Brisket'],
    rating: 4.5,
    reviewCount: 10,
    popularTimes: 'Afternoon',
    bestFor: 'Groups',
    tags: ['bbq'],
    ...overrides,
  };
}

function preferences(overrides: Partial<HangoutPreferences> = {}): HangoutPreferences {
  return {
    groupName: 'The goobers',
    friendCount: 1,
    location: 'Austin, TX',
    date: '2026-10-26',
    timePreference: 'afternoon',
    maxBudgetPerPerson: 40,
    selectedInterests: ['food', 'music'],
    friends: [
      {
        id: 'f-1',
        name: 'Alex',
        avatarColor: 'bg-leaf text-white',
        availabilitySlots: [{ id: 's-1', startTime: '14:00', endTime: '18:00' }],
        topInterests: ['food'],
      },
    ],
    ...overrides,
  };
}

function gapMinutes(left: ItineraryItem, right: ItineraryItem): number {
  const first = parseSlotLabel(left.timeSlot);
  const second = parseSlotLabel(right.timeSlot);
  assert.ok(first && second);
  const start = timeToMinutes(second.start);
  const end = timeToMinutes(first.end);
  assert.ok(start !== null && end !== null);
  return start - end;
}

describe('itinerary reorder and swap', () => {
  it('reorders stops and rebuilds times, travel gaps, and the same total', () => {
    const prefs = preferences();
    const first = activity({ id: 'brisket', name: 'Brisket porch', durationMinutes: 60, estimatedCostPerPerson: 10 });
    const second = activity({
      id: 'springs',
      name: 'Barton dip',
      category: 'outdoors',
      categoryLabel: 'Outdoors',
      durationMinutes: 30,
      estimatedCostPerPerson: 5,
    });
    const items = buildItinerary([first, second], prefs);
    assert.equal(items[0]?.timeSlot, '2:00 PM - 3:00 PM');
    assert.equal(items[1]?.timeSlot, '3:20 PM - 3:50 PM');
    assert.equal(gapMinutes(items[0], items[1]), TRAVEL_BUFFER_MINUTES);

    const moved = reorderItinerary(items, 1, 0, prefs);
    assert.deepEqual(
      moved.map((item) => item.activity.name),
      ['Barton dip', 'Brisket porch']
    );
    assert.equal(moved[0]?.timeSlot, '2:00 PM - 2:30 PM');
    assert.equal(moved[1]?.timeSlot, '2:50 PM - 3:50 PM');
    assert.equal(gapMinutes(moved[0], moved[1]), TRAVEL_BUFFER_MINUTES);
    assert.equal(spendSummary(moved, 1, 40).totalCostPerPerson, 15);
    assert.equal(reorderItinerary(items, 0, 0, prefs), items);
    assert.equal(reorderItinerary(items, -1, 0, prefs), items);
  });

  it('swaps a stop, keeps Muse fields, and recomputes cost and time', () => {
    const prefs = preferences();
    const items = buildItinerary(
      [
        activity({ id: 'brisket', estimatedCostPerPerson: 10, durationMinutes: 60 }),
        activity({ id: 'arcade', name: 'Arcade', estimatedCostPerPerson: 12, durationMinutes: 60 }),
      ],
      prefs
    );
    const replacement = activity({
      id: 'museum',
      name: 'Kelly chapel',
      category: 'arts',
      categoryLabel: 'Arts & Culture',
      estimatedCostPerPerson: 18,
      durationMinutes: 90,
      museEnriched: true,
      whyThisFits: 'Quiet and close to campus.',
      kind: 'place',
      venue: 'Blanton',
    });
    const swapped = swapItineraryStop(items, 0, replacement, prefs);
    assert.equal(swapped[0]?.activity.name, 'Kelly chapel');
    assert.equal(swapped[0]?.activity.museEnriched, true);
    assert.equal(swapped[0]?.activity.whyThisFits, 'Quiet and close to campus.');
    assert.equal(swapped[0]?.activity.venue, 'Blanton');
    assert.equal(swapped[0]?.timeSlot, '2:00 PM - 3:30 PM');
    assert.equal(swapped[1]?.activity.id, 'arcade');
    assert.equal(gapMinutes(swapped[0], swapped[1]), TRAVEL_BUFFER_MINUTES);
    assert.equal(spendSummary(swapped, 2, 40).totalCostPerPerson, 30);
    assert.equal(spendSummary(swapped, 2, 40).totalGroupCost, 60);
    assert.equal(swapItineraryStop(items, 0, items[0].activity, prefs), items);
  });

  it('refuses reorder and swap once the itinerary is locked, then allows them after unlock', () => {
    const prefs = preferences();
    const items = buildItinerary(
      [activity({ id: 'a', name: 'First' }), activity({ id: 'b', name: 'Second', durationMinutes: 30 })],
      prefs
    );
    const state = { items, locked: false };
    const locked = editItinerary(state, { type: 'lock' }, prefs);
    assert.equal(locked.locked, true);
    assert.equal(locked.items, items);
    const blockedMove = editItinerary(locked, { type: 'reorder', from: 0, to: 1 }, prefs);
    const blockedSwap = editItinerary(
      locked,
      { type: 'swap', index: 0, activity: activity({ id: 'c', name: 'Third' }) },
      prefs
    );
    assert.equal(blockedMove, locked);
    assert.equal(blockedSwap, locked);
    assert.deepEqual(
      blockedMove.items.map((item) => item.activity.name),
      ['First', 'Second']
    );

    const unlocked = editItinerary(locked, { type: 'unlock' }, prefs);
    assert.equal(unlocked.locked, false);
    const moved = editItinerary(unlocked, { type: 'reorder', from: 0, to: 1 }, prefs);
    assert.equal(moved.items[0]?.activity.name, 'Second');
    assert.notEqual(moved.items[0]?.timeSlot, items[0]?.timeSlot);
  });

  it('drops the pointer on the row whose midpoint it has passed', () => {
    assert.equal(indexFromPointer(40, [50, 150, 250]), 0);
    assert.equal(indexFromPointer(60, [50, 150, 250]), 1);
    assert.equal(indexFromPointer(160, [50, 150, 250]), 2);
    assert.equal(indexFromPointer(400, [50, 150, 250]), 2);
    assert.equal(indexFromPointer(10, []), 0);
  });

  it('names the downloaded image from the hangout', () => {
    assert.equal(itineraryImageFilename('The goobers'), 'the-goobers-itinerary.png');
    assert.equal(itineraryImageFilename('!!!'), 'hangout-itinerary.png');
  });
});

describe('swap candidates', () => {
  it('hides expired events, over-budget swaps, and stops outside the free window', () => {
    const prefs = preferences({
      maxBudgetPerPerson: 30,
      friends: [
        {
          id: 'f-1',
          name: 'Alex',
          avatarColor: 'bg-ink text-sun',
          availabilitySlots: [{ id: 's-1', startTime: '14:00', endTime: '15:00' }],
          topInterests: ['food'],
        },
      ],
    });
    const current = buildItinerary(
      [
        activity({ id: 'now', name: 'Now', durationMinutes: 30, estimatedCostPerPerson: 10 }),
        activity({ id: 'later', name: 'Later', durationMinutes: 30, estimatedCostPerPerson: 10 }),
      ],
      prefs
    );
    const pool = [
      activity({ id: 'now' }),
      activity({
        id: 'ended',
        name: 'Last week festival',
        kind: 'event',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        category: 'music',
        tags: ['festival'],
      }),
      activity({
        id: 'future',
        name: 'November fair',
        kind: 'event',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        category: 'music',
      }),
      activity({
        id: 'tonight',
        name: 'Hangout day show',
        kind: 'event',
        startDate: '2026-10-26',
        endDate: '2026-10-26',
        category: 'music',
        estimatedCostPerPerson: 8,
        durationMinutes: 30,
        museEnriched: true,
        whyThisFits: 'Everyone wanted music.',
      }),
      activity({ id: 'pricey', name: 'Tasting menu', estimatedCostPerPerson: 48, durationMinutes: 30 }),
      activity({ id: 'long', name: 'All afternoon hike', durationMinutes: 180, estimatedCostPerPerson: 8 }),
      activity({ id: 'short', name: 'Coffee', durationMinutes: 30, estimatedCostPerPerson: 8, category: 'chill' }),
    ];

    assert.equal(eventBlocked(pool[1], '2026-10-25', '2026-10-26'), true);
    assert.equal(eventBlocked(pool[3], '2026-10-25', '2026-10-26'), false);

    const firstStop = filterSwapCandidates({
      pool,
      itinerary: current,
      index: 0,
      preferences: prefs,
      today: '2026-10-25',
    });
    assert.equal(firstStop.hidden.expired, 2);
    assert.equal(firstStop.hidden.budget, 1);
    assert.equal(firstStop.hidden.availability, 1);
    assert.equal(firstStop.hidden.alreadyOnItinerary, 1);
    assert.deepEqual(
      firstStop.activities.map((item) => item.id),
      ['tonight', 'short']
    );
    assert.equal(firstStop.activities[0]?.museEnriched, true);

    const music = filterSwapCandidates({
      pool,
      itinerary: current,
      index: 0,
      preferences: prefs,
      today: '2026-10-25',
      category: 'music',
      query: 'hangout music',
    });
    assert.deepEqual(
      music.activities.map((item) => item.name),
      ['Hangout day show']
    );

    const missed = filterSwapCandidates({
      pool,
      itinerary: current,
      index: 0,
      preferences: prefs,
      today: '2026-10-25',
      query: 'zzzznotathing',
    });
    assert.equal(missed.activities.length, 0);

    const late = buildItinerary(
      [
        activity({ id: 'now', name: 'Now', durationMinutes: 90, estimatedCostPerPerson: 10 }),
        activity({ id: 'later', name: 'Later', durationMinutes: 30, estimatedCostPerPerson: 10 }),
      ],
      prefs
    );
    const secondStop = filterSwapCandidates({
      pool,
      itinerary: late,
      index: 1,
      preferences: prefs,
      today: '2026-10-25',
      category: 'music',
    });
    assert.equal(secondStop.hidden.availability >= 1, true);
    assert.equal(
      secondStop.activities.some((item) => item.id === 'tonight'),
      false
    );
  });
});
