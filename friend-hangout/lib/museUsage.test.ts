import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { museComplete } from './museClient.ts';
import { parseMuseEnrichments } from './museEnrich.ts';
import { heuristicWhy, parseBudgetCopy, parseMusePlan } from './musePlan.ts';
import { museCallsToday, museMaxCallsPerDay, recordMuseCall, tokenUsageFromApi } from './museUsage.ts';

describe('Muse usage guard', () => {
  const previousKey = process.env.MUSE_API_KEY;
  const previousLimit = process.env.MUSE_MAX_CALLS_PER_DAY;

  after(() => {
    if (previousKey === undefined) delete process.env.MUSE_API_KEY;
    else process.env.MUSE_API_KEY = previousKey;
    if (previousLimit === undefined) delete process.env.MUSE_MAX_CALLS_PER_DAY;
    else process.env.MUSE_MAX_CALLS_PER_DAY = previousLimit;
  });

  it('defaults the daily cap and reads token usage', () => {
    assert.equal(museMaxCallsPerDay(undefined), 200);
    assert.equal(museMaxCallsPerDay('0'), 0);
    assert.equal(museMaxCallsPerDay('5000'), 1000);
    assert.deepEqual(tokenUsageFromApi({ usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } }), {
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
    });
  });

  it('logs one call, serves the cache next, and stops at the daily cap', async () => {
    process.env.MUSE_API_KEY = 'test-key';
    process.env.MUSE_MAX_CALLS_PER_DAY = '1';
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T15:00:00.000Z');
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"explanation":"You can spend a little.","tips":["Keep a buffer"]}' } }],
          usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    const first = await museComplete(db, {
      purpose: 'budget',
      cacheKey: 'budget-1',
      messages: [{ role: 'user', content: 'explain' }],
      now,
      fetchImpl,
    });
    const second = await museComplete(db, {
      purpose: 'budget',
      cacheKey: 'budget-1',
      messages: [{ role: 'user', content: 'explain' }],
      now,
      fetchImpl,
    });
    const third = await museComplete(db, {
      purpose: 'budget',
      cacheKey: 'budget-2',
      messages: [{ role: 'user', content: 'again' }],
      now,
      fetchImpl,
    });
    assert.equal(first.cached, false);
    assert.match(first.content || '', /buffer/);
    assert.equal(second.cached, true);
    assert.equal(third.limited, true);
    assert.equal(calls, 1);
    assert.equal(museCallsToday(db, now), 1);
    db.close();
  });

  it('counts an error toward the cap', () => {
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T15:00:00.000Z');
    recordMuseCall(db, { purpose: 'enrich', status: 'error', now });
    assert.equal(museCallsToday(db, now), 1);
    db.close();
  });
});

describe('Muse parsers', () => {
  it('reads enrichment, plan picks, and budget copy', () => {
    const enriched = parseMuseEnrichments(
      JSON.stringify([
        {
          id: 'spot-1',
          kind: 'event',
          startDate: '2026-10-10',
          endDate: '2026-10-12',
          venue: 'Zilker Park',
          address: '2100 Barton Springs Rd',
          estimatedCostPerPerson: 40,
          category: 'music',
          tags: ['festival', 'festival'],
        },
      ])
    );
    assert.equal(enriched.get('spot-1')?.venue, 'Zilker Park');
    assert.equal(enriched.get('spot-1')?.category, 'music');
    assert.deepEqual(enriched.get('spot-1')?.tags, ['festival']);

    const plan = parseMusePlan(
      JSON.stringify({
        picks: [
          { id: 'ok', whyThisFits: 'It fits the window.' },
          { id: 'nope', whyThisFits: 'Unknown.' },
        ],
        aiRationale: 'A short plan.',
        budgetTips: ['Leave a buffer'],
      }),
      new Set(['ok'])
    );
    assert.equal(plan?.picks.length, 1);
    assert.equal(plan?.picks[0]?.id, 'ok');
    assert.equal(parseBudgetCopy('{"explanation":"Room for tacos.","tips":["Skip the second round"]}')?.explanation, 'Room for tacos.');
    assert.match(heuristicWhy({ category: 'food', estimatedCostPerPerson: 20 }, ['food'], 50), /within the \$50 cap/);
  });
});
