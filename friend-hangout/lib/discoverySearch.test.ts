import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import type { Activity } from '@/types';
import type { ActivityDraft } from './activityStore.ts';
import { getActivityRow, upsertActivity } from './activityStore.ts';
import { discoverActivities } from './discoverActivities.ts';
import { buildSearchText, enrichStoredActivities } from './discoverySearch.ts';
import { ENRICH_MAX_TOKENS, ENRICH_REASONING_EFFORT } from './museEnrich.ts';
import { readMuseContentCache } from './museUsage.ts';

function draft(now: Date, overrides: Partial<ActivityDraft> = {}): ActivityDraft {
  return {
    name: 'Saxon Pub',
    url: 'https://saxonpub.com',
    snippet: 'Live music nightly',
    category: 'music',
    categoryLabel: 'Live Music',
    location: 'Austin, TX (saxonpub.com)',
    neighborhood: 'saxonpub.com',
    estimatedCostPerPerson: 20,
    durationMinutes: 90,
    sourceQuery: 'Austin, TX best things to do with friends venues activities',
    classification: { kind: 'place', startDate: null, endDate: null, source: 'heuristic' },
    now,
    ...overrides,
  };
}

describe('discovery search', () => {
  const previousKey = process.env.MUSE_API_KEY;

  after(() => {
    if (previousKey === undefined) delete process.env.MUSE_API_KEY;
    else process.env.MUSE_API_KEY = previousKey;
  });

  it('builds a focused query for a term and keeps the generic phrase for a blank search', () => {
    assert.equal(buildSearchText('Austin, TX', 'all', 'tacos'), 'tacos in Austin, TX');
    assert.equal(buildSearchText('Austin, TX', 'food', 'tacos'), 'tacos food in Austin, TX');
    assert.equal(
      buildSearchText('Austin, TX', 'all', '  '),
      'Austin, TX best things to do with friends venues activities'
    );
    assert.doesNotMatch(buildSearchText('Austin, TX', 'all', 'tacos'), /best things to do/);
  });

  it('waits for OpenSERP when nothing saved matches, and skips sponsored titles', async () => {
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T12:00:00.000Z');
    upsertActivity(db, draft(now));
    upsertActivity(
      db,
      draft(now, {
        name: 'Austin Kayaking Fun - Austin Water Adventures Ad',
        url: 'https://ads.example/kayak',
        snippet: 'Sponsored kayak tour',
      })
    );
    let requested = '';
    const fetchImpl: typeof fetch = async (input) => {
      requested = String(input);
      return new Response(
        JSON.stringify({
          results: [
            {
              title: 'Breakfast tacos on South Congress',
              url: 'https://tacos.example/south-congress',
              snippet: 'Tacos in Austin',
              domain: 'tacos.example',
            },
            {
              title: 'Austin Kayaking Fun - Austin Water Adventures Ad',
              url: 'https://ads.example/kayak-2',
              snippet: 'Sponsored',
              domain: 'ads.example',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    const found = await discoverActivities(db, {
      query: 'tacos',
      location: 'Austin, TX',
      now,
      fetchImpl,
      allowMuse: false,
    });
    assert.match(decodeURIComponent(requested), /tacos in Austin, TX/);
    assert.doesNotMatch(decodeURIComponent(requested), /best things to do/);
    assert.equal(found.source, 'openserp');
    assert.deepEqual(
      found.activities.map((activity) => activity.name),
      ['Breakfast tacos on South Congress']
    );
    const names = db.prepare(`SELECT name FROM activities`).all() as Array<{ name: string }>;
    assert.equal(names.some((row) => row.name.endsWith(' Ad')), false);
    assert.equal(names.some((row) => row.name === 'Breakfast tacos on South Congress'), true);
    db.close();
  });

  it('uses the wider saved list only when OpenSERP fails', async () => {
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T12:00:00.000Z');
    upsertActivity(db, draft(now));
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 500 });
    const found = await discoverActivities(db, {
      query: 'tacos',
      location: 'Austin, TX',
      now,
      fetchImpl,
      allowMuse: false,
    });
    assert.equal(found.source, 'saved');
    assert.equal(found.relaxed, true);
    assert.match(found.notice || '', /wider saved list/);
    assert.equal(found.activities[0]?.name, 'Saxon Pub');
    db.close();
  });

  it('writes a parsed enrichment and does not cache a truncated reply', async () => {
    process.env.MUSE_API_KEY = 'test-key';
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T12:00:00.000Z');
    const first = upsertActivity(
      db,
      draft(now, { name: 'Torchy Tacos', url: 'https://tacos.example/torchy', snippet: 'Tacos' })
    );
    const second = upsertActivity(
      db,
      draft(now, { name: 'Veracruz', url: 'https://tacos.example/veracruz', snippet: 'More tacos' })
    );
    const complete = {
      id: first.id,
      kind: 'place',
      startDate: null,
      endDate: null,
      venue: 'South Congress',
      address: '123 S Congress Ave',
      estimatedCostPerPerson: 12,
      category: 'food',
      tags: ['tacos'],
    };
    let calls = 0;
    let body: { max_tokens?: number; max_completion_tokens?: number; reasoning_effort?: string } | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls += 1;
      body = JSON.parse(String(init?.body)) as { max_tokens?: number; max_completion_tokens?: number; reasoning_effort?: string };
      const content =
        calls === 1
          ? `${JSON.stringify([complete]).slice(0, -1)},{"id":"${second.id}","kind":"pla`
          : JSON.stringify([
              complete,
              {
                id: second.id,
                kind: 'place',
                startDate: null,
                endDate: null,
                venue: 'East Austin',
                address: '400 E 6th St',
                estimatedCostPerPerson: 14,
                category: 'food',
                tags: ['tacos'],
              },
            ]);
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: calls === 1 ? 'length' : 'stop', message: { content } }],
          usage: { prompt_tokens: 20, completion_tokens: calls === 1 ? 1600 : 400, total_tokens: 500 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await enrichStoredActivities(db, [first.id, second.id], fetchImpl);
    const partial = getActivityRow(db, first.id);
    assert.equal(partial?.classification_source, 'muse');
    assert.ok(partial?.enriched_at);
    assert.equal(partial?.venue, 'South Congress');
    assert.equal(partial?.address, '123 S Congress Ave');
    assert.equal(partial?.category, 'food');
    assert.equal(partial?.estimated_cost, 12);
    assert.equal(getActivityRow(db, second.id)?.enriched_at ?? null, null);
    assert.equal(body?.max_completion_tokens, ENRICH_MAX_TOKENS);
    assert.equal(body?.max_tokens, undefined);
    assert.equal(ENRICH_MAX_TOKENS, 8192);
    assert.equal(body?.reasoning_effort, ENRICH_REASONING_EFFORT);
    assert.ok(ENRICH_MAX_TOKENS > 1600);
    assert.equal(readMuseContentCache(db, 'missing', now), null);
    const cached = db.prepare(`SELECT COUNT(*) AS n FROM muse_response_cache`).get() as { n: number };
    assert.equal(cached.n, 0);

    await enrichStoredActivities(db, [second.id], fetchImpl);
    const done = getActivityRow(db, second.id);
    assert.equal(done?.classification_source, 'muse');
    assert.equal(done?.venue, 'East Austin');
    assert.equal(done?.estimated_cost, 14);
    assert.equal(calls, 2);
    db.close();
  });

  it('adds a matching upcoming calendar event when OpenSERP has nothing saved', async () => {
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T18:00:00.000Z');
    const doja: Activity = {
      id: 'doja-cat-moody-2026',
      name: 'Doja Cat',
      category: 'music',
      categoryLabel: 'Live Music',
      location: 'Austin, TX',
      neighborhood: 'Moody Center',
      estimatedCostPerPerson: 0,
      priceListed: false,
      durationMinutes: 150,
      description: 'Tour Ma Vie at Moody Center.',
      highlights: [],
      rating: 0,
      reviewCount: 0,
      popularTimes: '',
      bestFor: 'Moody Center',
      tags: ['Shows'],
      sourceUrl: 'https://moodycenteratx.com/event/doja-cat-2026/',
      kind: 'event',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      resultFreshness: 'catalog',
    };
    const ended: Activity = { ...doja, id: 'old-show', name: 'Old Show', startDate: '2026-10-01', endDate: '2026-10-02' };
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 500 });
    const found = await discoverActivities(db, {
      query: 'Doja',
      location: 'Austin, TX',
      now,
      fetchImpl,
      allowMuse: false,
      catalogActivities: [doja, ended],
    });
    assert.equal(found.source, 'fallback');
    assert.deepEqual(
      found.activities.map((activity) => activity.name),
      ['Doja Cat']
    );
    assert.equal(found.activities[0]?.priceListed, false);
    db.close();
  });
});
