import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  squadPricePointCacheKey,
  estimateSquadPricePoint,
} from './nessiePricePoint.ts';
import { INITIAL_FRIENDS } from './mockData.ts';
import type { Friend } from '@/types';

describe('nessiePricePoint unit tests', () => {
  it('generates deterministic squad price point cache key', () => {
    const key1 = squadPricePointCacheKey(INITIAL_FRIENDS);
    const key2 = squadPricePointCacheKey([...INITIAL_FRIENDS].reverse());
    assert.equal(key1, key2, 'Cache key should be order-independent');
    assert.ok(key1.startsWith('squad-pp:'), 'Cache key should have squad-pp prefix');
  });

  it('calculates price point recommendations with simulated fallback when no API key', async () => {
    const memoryDb = new DatabaseSync(':memory:');
    const mockFriends: Friend[] = [
      {
        id: 'f-1',
        name: 'High Spender',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [
          { id: 's-1', startTime: '12:00', endTime: '18:00', label: '12-6' },
        ],
        budgetPreference: 80,
        topInterests: ['food'],
      },
      {
        id: 'f-2',
        name: 'Budget Saver',
        avatarColor: 'bg-amber-600 text-white',
        availabilitySlots: [
          { id: 's-2', startTime: '12:00', endTime: '18:00', label: '12-6' },
        ],
        budgetPreference: 15,
        topInterests: ['outdoors'],
      },
    ];

    const advisory = await estimateSquadPricePoint(mockFriends, memoryDb);
    assert.ok(advisory, 'Should return advisory response');
    assert.equal(advisory.friends.length, 2);

    const highSpender = advisory.friends.find((f) => f.name === 'High Spender');
    const budgetSaver = advisory.friends.find((f) => f.name === 'Budget Saver');

    assert.ok(highSpender);
    assert.ok(budgetSaver);
    assert.ok(
      highSpender.suggestedPricePoint >= budgetSaver.suggestedPricePoint,
      'High spender comfort limit should be >= budget saver comfort limit'
    );
    assert.ok(
      advisory.groupPricePoint <= highSpender.suggestedPricePoint,
      'Group price point should be accessible and capped'
    );
    assert.ok(advisory.rationale.length > 0);
    assert.ok(advisory.coordinationTip.length > 0);
  });

  it('accurately resolves known Nessie customer names to customer IDs', async () => {
    const memoryDb = new DatabaseSync(':memory:');
    const friendsWithNames: Friend[] = [
      {
        id: 'f-m',
        name: 'Marcus Whitfield',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [{ id: 's-1', startTime: '14:00', endTime: '18:00' }],
        topInterests: ['food'],
      },
      {
        id: 'f-t',
        name: 'Tyler Nguyen',
        avatarColor: 'bg-amber-600 text-white',
        availabilitySlots: [{ id: 's-2', startTime: '14:00', endTime: '18:00' }],
        topInterests: ['gaming'],
      },
    ];

    const advisory = await estimateSquadPricePoint(friendsWithNames, memoryDb);
    const marcus = advisory.friends.find((f) => f.name === 'Marcus Whitfield');
    const tyler = advisory.friends.find((f) => f.name === 'Tyler Nguyen');

    assert.equal(marcus?.nessieCustomerId, '83541dfe-0a77-46ad-96dd-add64e9f7371');
    assert.equal(tyler?.nessieCustomerId, 'bb85e0fa-4390-4c2d-96de-e465e84430a6');
  });
});
