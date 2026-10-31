import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Activity, ActivityCategory, HangoutPreferences } from '@/types';
import { curatedVenueCounts } from './curatedActivities.ts';
import { isListicleListing } from './musePlan.ts';
import { assemblePlanCandidates, limitDiscoveredForPlan, selectPlanStops, withCuratedFallback } from './planCandidates.ts';
import { generatePlan } from './planner.ts';

const CATEGORIES: ActivityCategory[] = ['food', 'music', 'outdoors', 'gaming', 'sports', 'nightlife', 'arts', 'chill'];

function place(overrides: Partial<Activity> & Pick<Activity, 'id' | 'name'>): Activity {
  return {
    category: 'food',
    categoryLabel: 'Food & BBQ',
    location: 'Houston, TX',
    neighborhood: 'Downtown',
    estimatedCostPerPerson: 18,
    durationMinutes: 60,
    description: '',
    highlights: [],
    rating: 4,
    reviewCount: 10,
    popularTimes: 'Afternoon',
    bestFor: '',
    tags: [],
    ...overrides,
  };
}

function prefs(location: string): HangoutPreferences {
  return {
    groupName: 'Demo crew',
    friendCount: 4,
    location,
    date: '2026-10-25',
    timePreference: 'afternoon',
    maxBudgetPerPerson: 40,
    selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
    friends: [
      {
        id: 'f-1',
        name: 'Riley',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [{ id: 's-1', startTime: '14:00', endTime: '21:00' }],
        topInterests: ['food', 'music', 'outdoors'],
      },
    ],
  };
}

describe('curated venues and local fallback plans', () => {
  it('has at least six real venues for every city and interest category', () => {
    const counts = curatedVenueCounts();
    for (const city of ['Austin', 'Houston', 'Dallas', 'San Antonio'] as const) {
      for (const category of CATEGORIES) {
        assert.ok((counts[city][category] || 0) >= 6, `${city} ${category} has ${counts[city][category] || 0}`);
      }
    }
  });

  it('keeps one hit per narrow search and drops listicle titles', () => {
    const tacos = ['Torchy lookup', 'Taco stand', 'Another taco', 'Breakfast taco blog'].map((name, index) =>
      place({
        id: `taco-${index}`,
        name,
        sourceQuery: 'tacos in Houston',
        description: 'Tacos in Houston',
      })
    );
    const listicle = place({
      id: 'list',
      name: 'Best tacos in Houston',
      sourceQuery: 'tacos in Houston',
      sourceUrl: 'https://www.yelp.com/search?find_desc=tacos',
    });
    const escapeRoom = place({
      id: 'escape',
      name: 'TOP 10 BEST Escape Rooms in Austin, TX - Updated 2026',
      category: 'food',
      sourceQuery: 'escape room in Austin',
      description: TACO_NOISE,
      location: 'Austin, TX',
    });
    const realRoom = place({
      id: 'room',
      name: 'The Escape Game Austin',
      category: 'food',
      sourceQuery: 'escape room in Austin',
      description: TACO_NOISE,
      location: 'Austin, TX',
    });
    const kept = limitDiscoveredForPlan([...tacos, listicle, escapeRoom, realRoom]);
    const tacoHits = kept.filter((activity) => activity.sourceQuery === 'tacos in Houston');
    assert.equal(tacoHits.length, 1);
    assert.equal(
      kept.some((activity) => isListicleListing(activity.name, activity.sourceUrl)),
      false
    );
    assert.equal(kept.find((activity) => activity.id === 'room')?.category, 'gaming');
    assert.equal(
      kept.some((activity) => activity.name.startsWith('TOP 10')),
      false
    );
  });

  it('puts curated venues at the front of a long saved city list', () => {
    const saved = Array.from({ length: 12 }, (_, index) =>
      place({
        id: `saved-${index}`,
        name: `Saved Austin listing ${index}`,
        location: 'Austin, TX',
        category: index % 2 === 0 ? 'food' : 'music',
        categoryLabel: index % 2 === 0 ? 'Food & BBQ' : 'Live Music',
      })
    );
    saved.push(
      place({
        id: 'novel',
        name: 'Novel Escape | Top-Rated Escape Rooms in Austin, TX',
        location: 'Austin, TX',
        category: 'gaming',
        categoryLabel: 'Gaming & Arcades',
      })
    );
    const blended = withCuratedFallback(saved, { location: 'Austin, TX', category: 'all', query: '' });
    const lead = blended.slice(0, 6);
    assert.ok(lead.every((activity) => activity.id.startsWith('curated-')));
    assert.equal(new Set(lead.map((activity) => activity.category)).size, 6);
    assert.ok(blended.some((activity) => activity.name === 'Saved Austin listing 0'));
    assert.equal(
      blended.some((activity) => activity.name.includes('Top-Rated')),
      false
    );
    const names = blended.map((activity) => activity.name.toLowerCase());
    assert.equal(names.length, new Set(names).size);
  });

  it('leads a category page with that category’s curated venues and dedupes by name', () => {
    const blended = withCuratedFallback(
      [
        place({ id: 'saved-pecan', name: 'Pecan Lodge', location: 'Dallas, TX', category: 'food' }),
        ...Array.from({ length: 6 }, (_, index) =>
          place({
            id: `dallas-${index}`,
            name: `Dallas saved ${index}`,
            location: 'Dallas, TX',
            category: 'food',
          })
        ),
      ],
      { location: 'Dallas, TX', category: 'food', query: '' }
    );
    const firstSaved = blended.findIndex((activity) => activity.id.startsWith('dallas-'));
    assert.ok(firstSaved >= 6);
    assert.ok(blended.slice(0, firstSaved).every((activity) => activity.id.startsWith('curated-')));
    assert.ok(blended.slice(0, firstSaved).every((activity) => activity.category === 'food'));
    const pecans = blended.filter((activity) => activity.name === 'Pecan Lodge');
    assert.equal(pecans.length, 1);
    assert.equal(pecans[0]?.id.startsWith('curated-'), true);
  });

  it('leaves a specific miss on the live hit', () => {
    const blended = withCuratedFallback(
      [place({ id: 'doja', name: 'Doja Cat', category: 'music', categoryLabel: 'Live Music', location: 'Austin, TX' })],
      { location: 'Austin, TX', category: 'all', query: 'Doja' }
    );
    assert.deepEqual(
      blended.map((activity) => activity.name),
      ['Doja Cat']
    );
  });

  it('builds a different three-stop fallback for Austin, Houston, and Dallas', () => {
    const plans = ['Austin, TX', 'Houston, TX', 'Dallas, TX'].map((location) => {
      const plan = generatePlan(prefs(location), 'overall');
      const stops = plan.activities.map((activity) => ({
        name: activity.name,
        category: activity.categoryLabel,
        area: activity.neighborhood,
        cost: activity.estimatedCostPerPerson,
        when: activity.popularTimes,
      }));
      console.log(
        JSON.stringify(
          {
            city: location,
            stops,
            rationale: plan.aiRationale,
            icebreaker: plan.aiIcebreaker,
            tip: plan.aiCoordinationTip,
          },
          null,
          2
        )
      );
      return { location, plan, stops };
    });

    for (const entry of plans) {
      assert.equal(entry.plan.activities.length, 3);
      assert.ok(new Set(entry.plan.activities.map((activity) => activity.category)).size >= 2);
      assert.equal(
        entry.plan.activities.some((activity) => isListicleListing(activity.name, activity.sourceUrl)),
        false
      );
      assert.match(entry.plan.aiRationale, new RegExp(entry.location.split(',')[0], 'i'));
    }

    const names = plans.map((entry) => entry.stops.map((stop) => stop.name).join('|'));
    assert.notEqual(names[0], names[1]);
    assert.notEqual(names[0], names[2]);
    assert.notEqual(names[1], names[2]);
    assert.ok(plans[0].plan.activities.some((activity) => /Barton Springs|Franklin|Zilker|Continental Club/.test(activity.name)));
    assert.ok(plans[1].plan.activities.some((activity) => /Ninfa|Discovery Green|Museum of Fine Arts|Hermann/.test(activity.name)));
    assert.ok(plans[2].plan.activities.some((activity) => /Klyde Warren|Pecan Lodge|Deep Ellum|Dallas Museum of Art/.test(activity.name)));

    const houstonOnly = selectPlanStops(
      assemblePlanCandidates({
        discovered: [
          place({ id: 'junk', name: 'Best tacos in Houston', sourceQuery: 'tacos in Houston', sourceUrl: 'https://youtu.be/abc' }),
          place({ id: 'donut', name: 'Best donuts in Dallas', location: 'Houston, TX', sourceQuery: 'donuts in Dallas' }),
        ],
        location: 'Houston, TX',
        interests: ['food', 'music', 'outdoors', 'gaming'],
      }),
      prefs('Houston, TX')
    );
    assert.equal(houstonOnly.length, 3);
    assert.equal(
      houstonOnly.some((activity) => isListicleListing(activity.name, activity.sourceUrl)),
      false
    );
  });
});

const TACO_NOISE = 'Related: best tacos and restaurants on Yelp.';
