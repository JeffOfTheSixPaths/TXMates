import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  squadPricePointCacheKey,
  estimateSquadPricePoint,
  resolveCustomerId,
} from './nessiePricePoint.ts';
import { INITIAL_FRIENDS } from './mockData.ts';
import type { Friend } from '@/types';

describe('nessiePricePoint unit tests', () => {
  it('generates deterministic squad price point cache key', () => {
    const key1 = squadPricePointCacheKey(INITIAL_FRIENDS);
    const key2 = squadPricePointCacheKey([...INITIAL_FRIENDS].reverse());
    assert.equal(key1, key2, 'Cache key should be order-independent');
    assert.ok(key1.startsWith('squad-pp-priv:'), 'Cache key should have squad-pp-priv prefix');
  });

  it('resolves known customer names to Nessie customer IDs', () => {
    const marcus: Friend = {
      id: 'f-1',
      name: 'Marcus Whitfield',
      avatarColor: 'bg-teal-600',
      availabilitySlots: [],
      topInterests: ['food'],
    };
    const tyler: Friend = {
      id: 'f-3',
      name: 'Tyler N.',
      avatarColor: 'bg-amber-600',
      availabilitySlots: [],
      topInterests: ['gaming'],
    };
    assert.equal(resolveCustomerId(marcus), '83541dfe-0a77-46ad-96dd-add64e9f7371');
    assert.equal(resolveCustomerId(tyler), 'bb85e0fa-4390-4c2d-96de-e465e84430a6');
  });

  it('calculates price point recommendation without revealing individual bank balances', async () => {
    const memoryDb = new DatabaseSync(':memory:');
    const mockFriends: Friend[] = [
      {
        id: 'f-1',
        name: 'Friend A',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [
          { id: 's-1', startTime: '12:00', endTime: '18:00', label: '12-6' },
        ],
        budgetPreference: 60,
        topInterests: ['food'],
      },
      {
        id: 'f-2',
        name: 'Friend B',
        avatarColor: 'bg-amber-600 text-white',
        availabilitySlots: [
          { id: 's-2', startTime: '12:00', endTime: '18:00', label: '12-6' },
        ],
        budgetPreference: 20,
        topInterests: ['outdoors'],
      },
    ];

    const advisory = await estimateSquadPricePoint(mockFriends, memoryDb);
    assert.ok(advisory, 'Should return advisory response');
    assert.ok(Number.isFinite(advisory.groupPricePoint), 'groupPricePoint must be a valid number');
    assert.equal(advisory.groupTotalPool, advisory.groupPricePoint * 2, 'Total group pool should equal cap * friend count');
    assert.ok(advisory.rationale.length > 0);
    assert.ok(advisory.coordinationTip.length > 0);
    assert.equal(advisory.memberCount, 2);

    // Verify privacy: response object must NOT contain individual account/balance properties
    assert.equal((advisory as Record<string, unknown>).checking, undefined);
    assert.equal((advisory as Record<string, unknown>).savings, undefined);
    assert.equal((advisory as Record<string, unknown>).debt, undefined);
    assert.equal((advisory as Record<string, unknown>).friends, undefined);
  });
});
