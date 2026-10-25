import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchCatalog } from './catalogSearch.ts';

const catalog = [
  {
    name: 'Saxon Pub',
    description: 'Live music nightly on the patio',
    tags: ['honky-tonk'],
    category: 'music',
    categoryLabel: 'Live Music',
  },
  {
    name: "Torchy's Tacos",
    description: 'A trailer serving queso and tacos',
    tags: ['tacos'],
    category: 'food',
    categoryLabel: 'Food & BBQ',
  },
  {
    name: 'Barton Springs',
    description: 'A cold swim in the pool',
    tags: ['outdoors'],
    category: 'outdoors',
  },
];

describe('catalog search', () => {
  it('matches any word instead of the whole phrase', () => {
    const music = searchCatalog(catalog, 'live music');
    assert.equal(music.relaxed, false);
    assert.equal(music.activities[0]?.name, 'Saxon Pub');
    const tacos = searchCatalog(catalog, 'tacos');
    assert.equal(tacos.relaxed, false);
    assert.equal(tacos.activities[0]?.name, "Torchy's Tacos");
  });

  it('returns the wider list when nothing matches', () => {
    const missed = searchCatalog(catalog, 'zzzznotathing');
    assert.equal(missed.relaxed, true);
    assert.equal(missed.activities.length, catalog.length);
  });
});
