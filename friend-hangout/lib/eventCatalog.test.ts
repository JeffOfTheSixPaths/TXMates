import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  catalogEventToActivity,
  chicagoCivilDate,
  eventIsPast,
  loadEventCatalog,
  parseCatalogEvent,
  pruneEventDirectory,
  selectCatalogActivities,
} from './eventCatalog.ts';
import { mergeCollectedEvents, parseTicketmasterPayload } from './eventCollect.ts';

const sample = {
  id: 'kept-show',
  name: 'Kept Show',
  bucket: 'shows',
  category: 'music',
  categoryLabel: 'Live Music',
  location: 'Austin, TX',
  neighborhood: 'Downtown Austin',
  venue: 'Moody Center',
  address: '2001 Robert Dedman Dr, Austin, TX 78712',
  startDate: '2026-11-03',
  endDate: '2026-11-03',
  sourceUrl: 'https://example.test/kept',
  description: 'A show that has not ended.',
  estimatedCostPerPerson: null,
  durationMinutes: 150,
  durationIsEstimate: true,
  tags: ['Shows'],
  highlights: ['Moody Center'],
};

function writeEvent(dir: string, bucket: 'local' | 'shows', event: Record<string, unknown>) {
  const folder = path.join(dir, bucket);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, `${event.id}.json`), JSON.stringify(event));
}

describe('event catalog pruning', () => {
  it('reads committed event files as dated records with source urls', () => {
    const { events, unreadable } = loadEventCatalog();
    assert.deepEqual(unreadable, []);
    assert.ok(events.length > 0, 'data/events is empty; add upcoming events or run npm run events:collect');
    for (const event of events) {
      assert.match(event.sourceUrl, /^https:\/\//);
      assert.equal(event.name.length > 0, true);
      assert.equal(eventIsPast(event, '2026-10-25'), false);
    }
  });

  it('reads the America/Chicago calendar date across the midnight boundary', () => {
    assert.equal(chicagoCivilDate(new Date('2026-10-25T04:59:00.000Z')), '2026-10-24');
    assert.equal(chicagoCivilDate(new Date('2026-10-25T05:00:00.000Z')), '2026-10-25');
    assert.equal(chicagoCivilDate(new Date('2026-01-15T05:59:00.000Z')), '2026-01-14');
    assert.equal(chicagoCivilDate(new Date('2026-01-15T06:00:00.000Z')), '2026-01-15');
  });

  it('treats an event as past only after its end date, and never when it has no date', () => {
    assert.equal(eventIsPast({ startDate: '2026-10-24', endDate: '2026-10-24' }, '2026-10-25'), true);
    assert.equal(eventIsPast({ startDate: '2026-10-20', endDate: '2026-10-25' }, '2026-10-25'), false);
    assert.equal(eventIsPast({ startDate: '2026-10-24', endDate: null }, '2026-10-25'), true);
    assert.equal(eventIsPast({ startDate: '2026-11-01', endDate: null }, '2026-10-25'), false);
    assert.equal(eventIsPast({ startDate: null, endDate: null }, '2026-10-25'), false);
    assert.equal(eventIsPast({ startDate: 'October 1', endDate: null }, '2026-10-25'), false);
    assert.equal(eventIsPast({ startDate: '2026-02-31', endDate: null }, '2026-10-25'), false);
  });

  it('deletes only past event files, logs them, and is safe to run again', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'txmates-events-'));
    writeEvent(dir, 'shows', { ...sample, id: 'ended', name: 'Ended Show', startDate: '2026-10-10', endDate: '2026-10-12' });
    writeEvent(dir, 'shows', { ...sample, id: 'still-on', name: 'Still On', startDate: '2026-10-24', endDate: '2026-10-25' });
    writeEvent(dir, 'local', { ...sample, id: 'future', name: 'Future Fair', bucket: 'local', startDate: '2026-11-06', endDate: '2026-11-08' });
    writeEvent(dir, 'local', {
      ...sample,
      id: 'undated',
      name: 'Undated Market',
      bucket: 'local',
      startDate: null,
      endDate: null,
    });
    writeEvent(dir, 'shows', { ...sample, id: 'bad-date', name: 'Bad Date', startDate: 'not-a-date', endDate: '' });
    writeFileSync(path.join(dir, 'shows', 'broken.json'), '{');

    const now = new Date('2026-10-25T18:00:00.000Z');
    const first = pruneEventDirectory(dir, now);
    assert.equal(first.today, '2026-10-25');
    assert.equal(first.removed.length, 1);
    assert.equal(first.removed[0]?.name, 'Ended Show');
    assert.equal(first.removed[0]?.startDate, '2026-10-10');
    assert.equal(first.removed[0]?.endDate, '2026-10-12');
    assert.equal(first.undated, 2);
    assert.equal(first.kept, 4);
    assert.equal(first.unreadable.length, 1);
    assert.equal(loadEventCatalog(dir).events.some((event) => event.id === 'ended'), false);
    assert.ok(readFileSync(path.join(dir, 'local', 'undated.json'), 'utf8').includes('Undated Market'));

    const second = pruneEventDirectory(dir, now);
    assert.deepEqual(second.removed, []);
    assert.equal(second.kept, 4);
    assert.equal(second.undated, 2);
  });

  it('hides past catalog rows from search and keeps an undated one', () => {
    const future = catalogEventToActivity(parseCatalogEvent(sample)!);
    const past = catalogEventToActivity(
      parseCatalogEvent({ ...sample, id: 'old', name: 'Old Show', startDate: '2026-10-01', endDate: '2026-10-02' })!
    );
    const undated = catalogEventToActivity(
      parseCatalogEvent({ ...sample, id: 'no-date', name: 'Mystery', startDate: null, endDate: null })!
    );
    const picked = selectCatalogActivities([future, past, undated], 'all', '', '2026-10-25');
    assert.deepEqual(
      picked.map((activity) => activity.id),
      ['kept-show', 'no-date']
    );
    const named = selectCatalogActivities([future, past], 'music', 'kept', '2026-10-25');
    assert.equal(named.length, 1);
    assert.equal(named[0]?.name, 'Kept Show');
    assert.equal(named[0]?.priceListed, false);
    assert.equal(selectCatalogActivities([future], 'food', '', '2026-10-25').length, 0);
  });
});

describe('ticketmaster collection', () => {
  it('maps Austin music and sports, skips other cities, cancellations, and missing dates', () => {
    const events = parseTicketmasterPayload({
      _embedded: {
        events: [
          {
            id: 'abc123',
            name: 'Sample Band',
            url: 'https://www.ticketmaster.com/sample-band/event/abc123',
            info: 'A real listing.',
            dates: { start: { localDate: '2026-11-03' }, status: { code: 'onsale' } },
            priceRanges: [{ min: 42.4, currency: 'USD' }],
            classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
            _embedded: {
              venues: [{ name: 'Moody Center', city: { name: 'Austin' }, state: { stateCode: 'TX' }, address: { line1: '2001 Robert Dedman Dr' } }],
            },
          },
          {
            id: 'sport1',
            name: 'Sample FC',
            url: 'https://www.ticketmaster.com/sample-fc',
            dates: { start: { localDate: '2026-11-07' }, end: { localDate: '2026-11-07' } },
            classifications: [{ segment: { name: 'Sports' } }],
            _embedded: { venues: [{ name: 'Q2 Stadium', city: { name: 'Austin' }, state: { stateCode: 'TX' } }] },
          },
          {
            id: 'dallas',
            name: 'Dallas Show',
            url: 'https://www.ticketmaster.com/dallas',
            dates: { start: { localDate: '2026-11-08' } },
            classifications: [{ segment: { name: 'Music' } }],
            _embedded: { venues: [{ city: { name: 'Dallas' }, state: { stateCode: 'TX' } }] },
          },
          {
            id: 'cancelled',
            name: 'Cancelled Show',
            url: 'https://www.ticketmaster.com/cancelled',
            dates: { start: { localDate: '2026-11-09' }, status: { code: 'cancelled' } },
            classifications: [{ segment: { name: 'Music' } }],
            _embedded: { venues: [{ city: { name: 'Austin' }, state: { stateCode: 'TX' } }] },
          },
          {
            id: 'nodate',
            name: 'No Date',
            url: 'https://www.ticketmaster.com/nodate',
            dates: { start: {} },
            classifications: [{ segment: { name: 'Arts & Theatre' } }],
            _embedded: { venues: [{ city: { name: 'Austin' }, state: { stateCode: 'TX' } }] },
          },
        ],
      },
    });
    assert.equal(events.length, 2);
    assert.equal(events[0]?.bucket, 'shows');
    assert.equal(events[0]?.category, 'music');
    assert.equal(events[0]?.estimatedCostPerPerson, 42);
    assert.equal(events[0]?.id, 'tm-abc123');
    assert.equal(events[1]?.bucket, 'shows');
    assert.equal(events[1]?.category, 'sports');
    assert.equal(events[1]?.estimatedCostPerPerson, null);

    const again = mergeCollectedEvents(events, events);
    assert.equal(again.added.length, 0);
    assert.equal(again.skipped, 2);
    const fresh = mergeCollectedEvents(events.slice(0, 1), events);
    assert.equal(fresh.added.length, 1);
    assert.equal(fresh.added[0]?.name, 'Sample FC');
  });
});
