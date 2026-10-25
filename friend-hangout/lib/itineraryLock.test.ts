import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import type { HangoutPreferences } from '@/types';
import { initHangoutDb, saveHangoutToDb } from './db.ts';
import { buildItinerary, generatePlan } from './planner.ts';
import {
  parseItinerarySnapshot,
  readItineraryLock,
  writeItineraryLock,
} from './itineraryLock.ts';
import type { Activity } from '@/types';

function preferences(): HangoutPreferences {
  return {
    id: 'lock-demo',
    groupName: 'The goobers',
    friendCount: 1,
    location: 'Austin, TX',
    date: '2026-10-26',
    timePreference: 'afternoon',
    maxBudgetPerPerson: 50,
    selectedInterests: ['food'],
    friends: [
      {
        id: 'f-1',
        name: 'Alex',
        avatarColor: 'bg-leaf text-white',
        availabilitySlots: [{ id: 's-1', startTime: '14:00', endTime: '20:00' }],
        topInterests: ['food'],
      },
    ],
  };
}

function activity(id: string, name: string): Activity {
  return {
    id,
    name,
    category: 'food',
    categoryLabel: 'Food & BBQ',
    location: 'Austin, TX',
    neighborhood: 'Downtown Austin',
    estimatedCostPerPerson: 12,
    durationMinutes: 60,
    description: name,
    highlights: [],
    rating: 4,
    reviewCount: 1,
    popularTimes: '',
    bestFor: '',
    tags: [],
    museEnriched: true,
    whyThisFits: 'Fits the group.',
  };
}

describe('itinerary lock record', () => {
  it('stores the locked snapshot and keeps it when the hangout is saved again', () => {
    const db = new DatabaseSync(':memory:');
    initHangoutDb(db);
    const prefs = preferences();
    saveHangoutToDb(prefs, db);
    assert.deepEqual(readItineraryLock(db, 'lock-demo'), { locked: false, snapshot: null });

    const snapshot = buildItinerary(
      [activity('a', 'Brisket'), activity('b', 'Springs')],
      prefs
    );
    const locked = writeItineraryLock(db, 'lock-demo', true, snapshot);
    assert.equal(locked.locked, true);
    assert.equal(locked.snapshot?.[0]?.activity.name, 'Brisket');
    assert.equal(locked.snapshot?.[0]?.activity.whyThisFits, 'Fits the group.');
    assert.equal(locked.snapshot?.[1]?.timeSlot, snapshot[1]?.timeSlot);

    saveHangoutToDb({ ...prefs, groupName: 'Renamed mates' }, db);
    const stillLocked = readItineraryLock(db, 'lock-demo');
    assert.equal(stillLocked.locked, true);
    assert.equal(stillLocked.snapshot?.[0]?.activity.id, 'a');

    const unlocked = writeItineraryLock(db, 'lock-demo', false, snapshot);
    assert.equal(unlocked.locked, false);
    assert.equal(unlocked.snapshot?.[1]?.activity.name, 'Springs');
    db.close();
  });

  it('rejects a snapshot that is not an itinerary', () => {
    assert.equal(parseItinerarySnapshot(null), null);
    assert.equal(parseItinerarySnapshot('[]'), null);
    assert.equal(parseItinerarySnapshot([{ timeSlot: '2:00 PM - 3:00 PM' }]), null);
    assert.equal(parseItinerarySnapshot('not json'), null);
  });

  it('generates plans and itineraries dynamically for different cities', () => {
    const dallasPrefs = {
      ...preferences(),
      location: 'Dallas, TX',
    };
    const dallasPlan = generatePlan(dallasPrefs, 'overall');
    assert.equal(dallasPlan.itinerary.length, 3);
    assert.ok(
      dallasPlan.itinerary.some(
        (item) =>
          item.activity.location.includes('Dallas') ||
          item.activity.neighborhood.includes('Dallas') ||
          item.activity.id.startsWith('dal-')
      )
    );

    const seattlePrefs = {
      ...preferences(),
      location: 'Seattle, WA',
    };
    const seattlePlan = generatePlan(seattlePrefs, 'overall');
    assert.equal(seattlePlan.itinerary.length, 3);
    assert.ok(
      seattlePlan.itinerary.some(
        (item) =>
          item.activity.location.includes('Seattle') ||
          item.activity.neighborhood.includes('Seattle') ||
          item.activity.id.startsWith('sea-')
      )
    );
  });
});
