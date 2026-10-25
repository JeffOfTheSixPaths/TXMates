import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import type { HangoutPreferences } from '@/types';
import {
  ensureUserItemVotesTable,
  getDownvotedActivities,
  getUserItemVotes,
  isActivityDownvoted,
  penalizeDownvotedActivities,
  recordUserItemVote,
} from './userVotes.ts';
import { filterActivities, generatePlan } from './planner.ts';
import { MOCK_ACTIVITIES } from './mockData.ts';

function createTestPreferences(): HangoutPreferences {
  return {
    id: 'votes-test-hangout',
    groupName: 'Group Name Here',
    location: 'Austin, TX',
    date: '2026-10-26',
    timePreference: 'afternoon',
    maxBudgetPerPerson: 50,
    selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
    friendCount: 4,
    friends: [
      {
        id: 'f-1',
        name: 'Marcus W. (Organizer)',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [{ id: 's-1', startTime: '13:00', endTime: '21:00' }],
        budgetPreference: 35,
        topInterests: ['food', 'music', 'gaming'],
        nessieCustomerId: '83541dfe-0a77-46ad-96dd-add64e9f7371',
      },
      {
        id: 'f-2',
        name: 'Priya R.',
        avatarColor: 'bg-purple-600 text-white',
        availabilitySlots: [{ id: 's-2', startTime: '14:30', endTime: '20:30' }],
        budgetPreference: 50,
        topInterests: ['arts', 'chill', 'food'],
        nessieCustomerId: 'a5465fe4-0226-4701-8fe6-a9dfa6928b29',
      },
    ],
  };
}

describe('user item votes and persistent recommendation penalties', () => {
  it('creates user_item_votes table and records votes accurately', () => {
    const db = new DatabaseSync(':memory:');
    ensureUserItemVotesTable(db);

    const result = recordUserItemVote(db, {
      userId: 'f-1',
      customerId: '83541dfe-0a77-46ad-96dd-add64e9f7371',
      friendName: 'Marcus W. (Organizer)',
      activityId: 'act-1',
      activityName: "Terry Black's Barbecue",
      vote: 'down',
    });

    assert.equal(result.ok, true);
    assert.equal(result.vote, 'down');
    assert.equal(result.removed, false);

    const votes = getUserItemVotes(db, { userIds: ['f-1'] });
    assert.equal(votes.length, 1);
    assert.equal(votes[0]?.activityId, 'act-1');
    assert.equal(votes[0]?.activityName, "Terry Black's Barbecue");
    assert.equal(votes[0]?.vote, 'down');
    assert.equal(votes[0]?.customerId, '83541dfe-0a77-46ad-96dd-add64e9f7371');
  });

  it('updates vote on conflict and removes vote when vote is null', () => {
    const db = new DatabaseSync(':memory:');
    ensureUserItemVotesTable(db);

    // Initial upvote
    recordUserItemVote(db, {
      userId: 'f-2',
      friendName: 'Priya R.',
      activityId: 'act-2',
      activityName: 'Barton Springs Natural Pool',
      vote: 'up',
    });

    let votes = getUserItemVotes(db, { userIds: ['f-2'] });
    assert.equal(votes[0]?.vote, 'up');

    // Change to downvote
    recordUserItemVote(db, {
      userId: 'f-2',
      friendName: 'Priya R.',
      activityId: 'act-2',
      activityName: 'Barton Springs Natural Pool',
      vote: 'down',
    });

    votes = getUserItemVotes(db, { userIds: ['f-2'] });
    assert.equal(votes[0]?.vote, 'down');

    // Clear vote
    const cleared = recordUserItemVote(db, {
      userId: 'f-2',
      friendName: 'Priya R.',
      activityId: 'act-2',
      activityName: 'Barton Springs Natural Pool',
      vote: null,
    });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.vote, null);
    assert.equal(cleared.removed, true);

    votes = getUserItemVotes(db, { userIds: ['f-2'] });
    assert.equal(votes.length, 0);
  });

  it('extracts downvoted activities and filters by user or customer ID', () => {
    const db = new DatabaseSync(':memory:');
    ensureUserItemVotesTable(db);

    recordUserItemVote(db, {
      userId: 'f-1',
      customerId: '83541dfe-0a77-46ad-96dd-add64e9f7371',
      friendName: 'Marcus W.',
      activityId: 'act-1',
      activityName: "Terry Black's Barbecue",
      vote: 'down',
    });

    recordUserItemVote(db, {
      userId: 'f-1',
      customerId: '83541dfe-0a77-46ad-96dd-add64e9f7371',
      friendName: 'Marcus W.',
      activityId: 'act-2',
      activityName: 'Barton Springs Natural Pool',
      vote: 'love',
    });

    recordUserItemVote(db, {
      userId: 'f-2',
      customerId: 'a5465fe4-0226-4701-8fe6-a9dfa6928b29',
      friendName: 'Priya R.',
      activityId: 'act-3',
      activityName: 'Rainey Street Food Trucks',
      vote: 'down',
    });

    // Check downvoted activities for Marcus only
    const marcusDownvoted = getDownvotedActivities(db, { userIds: ['f-1'] });
    assert.equal(marcusDownvoted.ids.has('act-1'), true);
    assert.equal(marcusDownvoted.ids.has('act-2'), false); // Love, not down
    assert.equal(marcusDownvoted.ids.has('act-3'), false); // Disliked by Priya
    assert.equal(marcusDownvoted.names.has("terry black's barbecue"), true);

    // Check downvoted activities for both Marcus and Priya
    const groupDownvoted = getDownvotedActivities(db, { userIds: ['f-1', 'f-2'] });
    assert.equal(groupDownvoted.ids.has('act-1'), true);
    assert.equal(groupDownvoted.ids.has('act-3'), true);
    assert.equal(groupDownvoted.ids.has('act-2'), false);
  });

  it('checks if activity is downvoted by ID or case-insensitive name', () => {
    const downvotedIds = new Set(['act-1']);
    const downvotedNames = new Set(["terry black's barbecue"]);

    assert.equal(
      isActivityDownvoted({ id: 'act-1', name: 'Other Name' }, downvotedIds, downvotedNames),
      true
    );
    assert.equal(
      isActivityDownvoted({ id: 'custom-id', name: "Terry Black's Barbecue  " }, downvotedIds, downvotedNames),
      true
    );
    assert.equal(
      isActivityDownvoted({ id: 'act-99', name: 'Zilker Park' }, downvotedIds, downvotedNames),
      false
    );
  });

  it('penalizes downvoted activities by splitting and ranking preferred first', () => {
    const sample = MOCK_ACTIVITIES.slice(0, 5);
    const downvotedId = sample[0]?.id || 'act-1';
    const downvotedName = sample[0]?.name || '';

    const { preferred, deprioritized, allRanked } = penalizeDownvotedActivities(
      sample,
      new Set([downvotedId]),
      new Set([downvotedName.toLowerCase()])
    );

    assert.equal(preferred.length, 4);
    assert.equal(deprioritized.length, 1);
    assert.equal(deprioritized[0]?.id, downvotedId);
    assert.equal(allRanked[allRanked.length - 1]?.id, downvotedId);
  });

  it('makes future recommendations less likely to show downvoted places in generatePlan', () => {
    const prefs = createTestPreferences();

    // 1. Generate default overall plan without downvotes
    const defaultPlan = generatePlan(prefs, 'overall');

    // Pick an activity that was selected by default
    const firstSelectedAct = defaultPlan.activities[0];
    const firstSelectedId = firstSelectedAct?.id;
    assert.ok(firstSelectedId, 'A default activity must be selected');
    assert.ok(firstSelectedAct);

    // 2. Downvote that activity
    const downvotedIds = new Set([firstSelectedId]);
    const downvotedNames = new Set([firstSelectedAct.name.toLowerCase().trim()]);

    // 3. Generate new plan with downvotes
    const penalizedPlan = generatePlan(prefs, 'overall', null, {
      downvotedIds,
      downvotedNames,
    });
    const penalizedActivityIds = penalizedPlan.activities.map((a) => a.id);

    // Verify the downvoted activity is NOT recommended anymore
    assert.equal(
      penalizedActivityIds.includes(firstSelectedId),
      false,
      `Downvoted place ${firstSelectedAct.name} should not appear in recommended plan`
    );
    assert.equal(penalizedPlan.activities.length, 3);
  });

  it('penalizes downvoted places in cheapest and interests view types', () => {
    const prefs = createTestPreferences();

    // Cheapest view
    const defaultCheapest = generatePlan(prefs, 'cheapest');
    const cheapestId = defaultCheapest.activities[0]?.id;
    assert.ok(cheapestId);

    const penalizedCheapest = generatePlan(prefs, 'cheapest', null, {
      downvotedIds: new Set([cheapestId]),
    });
    assert.equal(
      penalizedCheapest.activities.some((a) => a.id === cheapestId),
      false,
      'Downvoted cheap place should be replaced with alternative cheap place'
    );

    // Interests view
    const defaultInterests = generatePlan(prefs, 'interests');
    const interestId = defaultInterests.activities[0]?.id;
    assert.ok(interestId);

    const penalizedInterests = generatePlan(prefs, 'interests', null, {
      downvotedIds: new Set([interestId]),
    });
    assert.equal(
      penalizedInterests.activities.some((a) => a.id === interestId),
      false,
      'Downvoted interest place should be replaced with alternative interest place'
    );
  });

  it('filterActivities respects downvoted preferences when alternatives exist', () => {
    const all = MOCK_ACTIVITIES;
    const downvotedId = all[0]?.id || 'act-1';
    const downvotedName = all[0]?.name || '';

    const filtered = filterActivities(all, 100, undefined, undefined, {
      downvotedIds: new Set([downvotedId]),
      downvotedNames: new Set([downvotedName.toLowerCase().trim()]),
    });

    assert.equal(
      filtered.some((a) => a.id === downvotedId),
      false,
      'Downvoted activity should be filtered out when sufficient alternatives exist'
    );
    assert.ok(filtered.length >= 3);
  });
});
