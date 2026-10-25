import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyListing, parseMuseClassifications } from './activityClassify.ts';

const now = new Date(2026, 9, 1, 12);

describe('activity classification', () => {
  it('marks festivals and tours as events and restaurants as places', () => {
    const festival = classifyListing({
      title: 'ACL Festival tickets Oct 10-12, 2026',
      snippet: 'Austin City Limits',
      now,
    });
    assert.equal(festival.kind, 'event');
    assert.equal(festival.startDate, '2026-10-10');
    assert.equal(festival.endDate, '2026-10-12');

    const tour = classifyListing({ title: 'Taylor Swift tour', snippet: 'Stadium show', now });
    assert.equal(tour.kind, 'event');

    const place = classifyListing({
      title: 'Franklin Barbecue',
      snippet: 'Restaurant open since October 3, 2009',
      now,
    });
    assert.equal(place.kind, 'place');
    assert.equal(place.startDate, null);
  });

  it('reads a Muse classification payload', () => {
    const parsed = parseMuseClassifications(
      '```json\n[{"id":"a","kind":"event","startDate":"2026-10-10","endDate":"2026-10-12"}]\n```'
    );
    assert.equal(parsed.get('a')?.kind, 'event');
    assert.equal(parsed.get('a')?.startDate, '2026-10-10');
  });
});
