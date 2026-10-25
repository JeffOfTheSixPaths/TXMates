import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import type { ActivityDraft } from './activityStore.ts';
import {
  activityId,
  applyMuseEnrichment,
  applyRecheck,
  cleanupActivities,
  getActivityRow,
  isSponsoredTitle,
  listUnenrichedIds,
  purgeJunkActivities,
  purgeSponsoredActivities,
  searchSavedActivities,
  upsertActivity,
} from './activityStore.ts';

const policy = { eventTtlDays: 30, placeStaleDays: 60 };

function draft(now: Date, overrides: Partial<ActivityDraft> = {}): ActivityDraft {
  return {
    name: "Torchy's Tacos",
    url: 'https://www.torchys.com/austin?utm_source=test',
    snippet: 'Tacos in Austin',
    category: 'food',
    categoryLabel: 'Food & BBQ',
    location: 'Austin, TX (torchys.com)',
    neighborhood: 'torchys.com',
    estimatedCostPerPerson: 25,
    durationMinutes: 90,
    sourceQuery: 'Austin food tacos',
    classification: { kind: 'place', startDate: null, endDate: null, source: 'heuristic' },
    now,
    ...overrides,
  };
}

function openDb() {
  const db = new DatabaseSync(':memory:');
  return db;
}

describe('activity store', () => {
  it('dedupes the same url and name and keeps the first seen time', () => {
    const db = openDb();
    const first = new Date('2026-10-01T12:00:00.000Z');
    const second = new Date('2026-10-02T12:00:00.000Z');
    const inserted = upsertActivity(db, draft(first));
    const updated = upsertActivity(
      db,
      draft(second, { url: 'https://torchys.com/austin', snippet: 'Still tacos' })
    );
    assert.equal(inserted.id, updated.id);
    assert.equal(updated.action, 'updated');
    assert.equal(activityId("Torchy's Tacos", 'https://torchys.com/austin'), inserted.id);
    const row = getActivityRow(db, inserted.id);
    assert.equal(row?.first_seen, first.toISOString());
    assert.equal(row?.last_seen, second.toISOString());
    assert.equal(row?.description, 'Still tacos');
    const other = upsertActivity(db, draft(second, { name: 'Torchy South' }));
    assert.notEqual(other.id, inserted.id);
    db.close();
  });

  it('searches by token and falls back to the wider list', () => {
    const db = openDb();
    const now = new Date('2026-10-25T12:00:00.000Z');
    upsertActivity(db, draft(now));
    upsertActivity(
      db,
      draft(now, {
        name: 'Saxon Pub',
        url: 'https://saxonpub.com',
        snippet: 'Live music nightly',
        category: 'music',
        categoryLabel: 'Live Music',
      })
    );
    const tacos = searchSavedActivities(db, { query: 'tacos', category: 'all' });
    assert.equal(tacos.relaxed, false);
    assert.equal(tacos.rows[0]?.name, "Torchy's Tacos");
    const missed = searchSavedActivities(db, { query: 'zzzznotathing', category: 'all' });
    assert.equal(missed.relaxed, true);
    assert.equal(missed.rows.length, 2);
    db.close();
  });

  it('deletes past events, undated events after the ttl, and stale places', () => {
    const db = openDb();
    const now = new Date(2026, 9, 25, 12);
    upsertActivity(
      db,
      draft(new Date(now.getTime() - 10 * 86_400_000), {
        name: 'ACL Festival',
        url: 'https://aclfestival.com',
        classification: { kind: 'event', startDate: '2026-10-10', endDate: '2026-10-12', source: 'heuristic' },
      })
    );
    upsertActivity(
      db,
      draft(new Date(now.getTime() - 31 * 86_400_000), {
        name: 'Mystery Show',
        url: 'https://example.test/show',
        classification: { kind: 'event', startDate: null, endDate: null, source: 'heuristic' },
      })
    );
    upsertActivity(
      db,
      draft(new Date(now.getTime() - 10 * 86_400_000), {
        name: 'Kept Show',
        url: 'https://example.test/kept',
        classification: { kind: 'event', startDate: null, endDate: null, source: 'heuristic' },
      })
    );
    upsertActivity(
      db,
      draft(new Date(now.getTime() - 61 * 86_400_000), {
        name: 'Old Park',
        url: 'https://example.test/park',
      })
    );
    const freshPlace = upsertActivity(db, draft(now, { name: 'New Park', url: 'https://example.test/new' }));
    const result = cleanupActivities(db, now, policy);
    assert.equal(result.deletedEvents, 2);
    assert.equal(result.removedPlaces, 1);
    assert.ok(getActivityRow(db, freshPlace.id));
    assert.equal(getActivityRow(db, activityId('Old Park', 'https://example.test/park')), null);
    db.close();
  });

  it('removes a place when a recheck misses and keeps it when the url returns', () => {
    const db = openDb();
    const now = new Date('2026-10-25T12:00:00.000Z');
    const saved = upsertActivity(db, draft(now));
    assert.equal(applyRecheck(db, saved.id, [], now), 'removed');
    assert.equal(getActivityRow(db, saved.id), null);
    const again = upsertActivity(db, draft(now));
    assert.equal(
      applyRecheck(db, again.id, [{ url: 'https://torchys.com/austin', name: 'Other' }], now),
      'kept'
    );
    assert.ok(getActivityRow(db, again.id));
    db.close();
  });

  it('enriches a row once', () => {
    const db = openDb();
    const now = new Date('2026-10-25T12:00:00.000Z');
    const saved = upsertActivity(
      db,
      draft(now, {
        name: 'ACL Festival',
        url: 'https://aclfestival.com',
        classification: { kind: 'place', startDate: null, endDate: null, source: 'heuristic' },
      })
    );
    assert.deepEqual(listUnenrichedIds(db, 10), [saved.id]);
    const applied = applyMuseEnrichment(
      db,
      {
        id: saved.id,
        kind: 'event',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        venue: 'Zilker Park',
        address: '2100 Barton Springs Rd',
        estimatedCostPerPerson: 120,
        category: 'music',
        categoryLabel: 'Live Music',
        tags: ['festival'],
      },
      now
    );
    assert.equal(applied, 'applied');
    assert.equal(applyMuseEnrichment(db, {
      id: saved.id,
      kind: 'place',
      startDate: null,
      endDate: null,
      venue: 'Nope',
      address: null,
      estimatedCostPerPerson: 1,
      category: 'food',
      categoryLabel: 'Food & BBQ',
      tags: [],
    }, now), 'skipped');
    const row = getActivityRow(db, saved.id);
    assert.equal(row?.kind, 'event');
    assert.equal(row?.venue, 'Zilker Park');
    assert.equal(row?.estimated_cost, 120);
    assert.equal(row?.category, 'music');
    assert.deepEqual(listUnenrichedIds(db, 10), []);
    db.close();
  });

  it('drops sponsored titles and purges ones already stored', () => {
    assert.equal(isSponsoredTitle('Austin Kayaking Fun - Austin Water Adventures Ad'), true);
    assert.equal(isSponsoredTitle("Torchy's Tacos"), false);
    const db = openDb();
    const now = new Date('2026-10-25T12:00:00.000Z');
    const ad = upsertActivity(
      db,
      draft(now, {
        name: 'Austin Kayaking Fun - Austin Water Adventures Ad',
        url: 'https://ads.example/kayak',
      })
    );
    const kept = upsertActivity(db, draft(now));
    assert.equal(purgeSponsoredActivities(db), 1);
    assert.equal(getActivityRow(db, ad.id), null);
    assert.ok(getActivityRow(db, kept.id));
    db.close();
  });

  it('deletes saved login pages and wrong-city rows', () => {
    const db = openDb();
    const now = new Date('2026-10-25T12:00:00.000Z');
    const login = upsertActivity(
      db,
      draft(now, {
        name: 'Sign in to your Microsoft account',
        url: 'https://login.live.com/',
        snippet: 'Outlook and Microsoft account',
        location: 'Austin, TX (login.live.com)',
        sourceQuery: 'live jazz in Austin, TX',
      })
    );
    const scores = upsertActivity(
      db,
      draft(now, {
        name: 'LiveScore',
        url: 'https://www.livescore.com/basketball',
        snippet: 'Live scores',
        location: 'Austin, TX (livescore.com)',
        sourceQuery: 'live jazz in Austin, TX',
      })
    );
    const harlingen = upsertActivity(
      db,
      draft(now, {
        name: 'Harlingen Bakery',
        url: 'https://harlingenbakery.example/',
        snippet: 'Family bakery in Harlingen, TX',
        location: 'Dallas (harlingenbakery.example)',
        sourceQuery: 'bakeries in Dallas',
      })
    );
    const dallas = upsertActivity(
      db,
      draft(now, {
        name: 'Empire Baking Company',
        url: 'https://empirebaking.com/dallas',
        snippet: 'Dallas bakery',
        location: 'Dallas (empirebaking.com)',
        sourceQuery: 'bakeries in Dallas',
      })
    );
    assert.equal(purgeJunkActivities(db), 3);
    assert.equal(getActivityRow(db, login.id), null);
    assert.equal(getActivityRow(db, scores.id), null);
    assert.equal(getActivityRow(db, harlingen.id), null);
    assert.ok(getActivityRow(db, dallas.id));
    assert.equal(purgeJunkActivities(db), 0);
    db.close();
  });
});
