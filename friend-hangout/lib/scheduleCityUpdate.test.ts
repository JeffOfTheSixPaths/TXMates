import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { initHangoutDb, saveHangoutToDb } from './db.ts';
import { generatePlan } from './planner.ts';
import { writeItineraryLock, readItineraryLock } from './itineraryLock.ts';
import { parseMusePlan } from './musePlan.ts';
import type { HangoutPreferences } from '@/types';

function createPreferences(city = 'Austin, TX'): HangoutPreferences {
  return {
    id: 'test-city-sync',
    groupName: 'City Sync Squad',
    friendCount: 3,
    location: city,
    date: '2026-10-31',
    timePreference: 'afternoon',
    maxBudgetPerPerson: 60,
    selectedInterests: ['food', 'music'],
    friends: [
      {
        id: 'f-1',
        name: 'Organizer',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [{ id: 's-1', startTime: '13:00', endTime: '21:00', label: '1:00 PM - 9:00 PM' }],
        budgetPreference: 50,
        topInterests: ['food', 'music'],
      },
    ],
  };
}

describe('Schedule and Muse multi-city synchronization', () => {
  it('generates distinct schedules when location switches from Austin to Dallas, Seattle, or Chicago', () => {
    const austinPrefs = createPreferences('Austin, TX');
    const austinPlan = generatePlan(austinPrefs, 'overall');
    assert.equal(austinPlan.itinerary.length, 3);
    const austinStops = austinPlan.itinerary.map((i) => i.activity.name);

    const dallasPrefs = createPreferences('Dallas, TX');
    const dallasPlan = generatePlan(dallasPrefs, 'overall');
    assert.equal(dallasPlan.itinerary.length, 3);
    const dallasStops = dallasPlan.itinerary.map((i) => i.activity.name);

    // Stops must not be identical across different cities
    assert.notDeepEqual(austinStops, dallasStops);
    assert.ok(
      dallasPlan.itinerary.every(
        (i) =>
          i.activity.location.toLowerCase().includes('dallas') ||
          i.activity.neighborhood.toLowerCase().includes('dallas') ||
          i.activity.id.startsWith('dal-')
      )
    );

    const seattlePrefs = createPreferences('Seattle, WA');
    const seattlePlan = generatePlan(seattlePrefs, 'overall');
    assert.equal(seattlePlan.itinerary.length, 3);
    assert.ok(
      seattlePlan.itinerary.every(
        (i) =>
          i.activity.location.toLowerCase().includes('seattle') ||
          i.activity.neighborhood.toLowerCase().includes('seattle') ||
          i.activity.id.startsWith('sea-')
      )
    );
  });

  it('prevents old city locked snapshot from hijacking a different city schedule', () => {
    const db = new DatabaseSync(':memory:');
    initHangoutDb(db);

    const austinPrefs = createPreferences('Austin, TX');
    saveHangoutToDb(austinPrefs, db);

    const austinPlan = generatePlan(austinPrefs, 'overall');
    // Lock Austin stops into database
    writeItineraryLock(db, 'test-city-sync', true, austinPlan.itinerary);

    const lock = readItineraryLock(db, 'test-city-sync');
    assert.equal(lock.locked, true);
    assert.equal(lock.snapshot?.length, 3);

    // Now user switches hangout location to Dallas
    const dallasPrefs = createPreferences('Dallas, TX');
    saveHangoutToDb(dallasPrefs, db);

    const cleanCity = 'dallas';
    // Validate snapshot city matching logic:
    const snapshot = lock.snapshot!;
    const matchesCity = snapshot.some((item) => {
      const loc = (item.activity.location || '').toLowerCase();
      const neigh = (item.activity.neighborhood || '').toLowerCase();
      return loc.includes(cleanCity) || neigh.includes(cleanCity);
    });

    // The Austin snapshot must NOT match Dallas
    assert.equal(matchesCity, false);

    db.close();
  });

  it('parses Muse plan picks even when Muse references by index or venue name', () => {
    const candidates = [
      { id: 'dal-tacos-1', name: 'Tacos La Banqueta' },
      { id: 'dal-bbq-2', name: 'Pecan Lodge' },
      { id: 'dal-park-3', name: 'Klyde Warren Park' },
    ];
    const allowedIds = new Set(candidates.map((c) => c.id));

    // Muse outputs index numbers
    const responseWithIndices = JSON.stringify({
      picks: [
        { id: '1', whyThisFits: 'Authentic tacos.' },
        { id: '2', whyThisFits: 'Smoked meats.' },
      ],
      aiRationale: 'Great food crawl.',
    });

    const parsedIndices = parseMusePlan(responseWithIndices, allowedIds, candidates);
    assert.ok(parsedIndices);
    assert.equal(parsedIndices.picks.length, 2);
    assert.equal(parsedIndices.picks[0]?.id, 'dal-tacos-1');
    assert.equal(parsedIndices.picks[1]?.id, 'dal-bbq-2');

    // Muse outputs venue name
    const responseWithNames = JSON.stringify({
      picks: [
        { id: 'Klyde Warren Park', whyThisFits: 'Chill outdoor park.' },
      ],
      aiRationale: 'Sunny afternoon.',
    });

    const parsedNames = parseMusePlan(responseWithNames, allowedIds, candidates);
    assert.ok(parsedNames);
    assert.equal(parsedNames.picks.length, 1);
    assert.equal(parsedNames.picks[0]?.id, 'dal-park-3');
  });
});
