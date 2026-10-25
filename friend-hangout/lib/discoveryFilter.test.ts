import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discoveryHitRejection, namesOtherCity } from './activityPolicy.ts';

describe('discovery junk and city filter', () => {
  it('drops login, account, and sports-score pages', () => {
    const austin = { location: 'Austin, TX', query: 'live jazz in Austin, TX' };
    assert.equal(
      discoveryHitRejection({
        title: 'Sign in to your Microsoft account',
        snippet: 'Use your Outlook account',
        url: 'https://login.live.com/',
        ...austin,
      }),
      'blocked-url'
    );
    assert.equal(
      discoveryHitRejection({
        title: 'Outlook',
        url: 'https://outlook.live.com/mail/',
        ...austin,
      }),
      'blocked-url'
    );
    assert.equal(
      discoveryHitRejection({
        title: 'Microsoft account',
        url: 'https://account.microsoft.com/',
        ...austin,
      }),
      'blocked-url'
    );
    assert.equal(
      discoveryHitRejection({
        title: 'LiveScore basketball',
        url: 'https://www.livescore.com/basketball',
        ...austin,
      }),
      'blocked-url'
    );
    assert.equal(
      discoveryHitRejection({
        title: 'The Elephant Room',
        snippet: 'Underground jazz bar in downtown Austin',
        url: 'https://elephantroom.com/',
        ...austin,
      }),
      null
    );
  });

  it('drops a different city and keeps the requested one', () => {
    assert.equal(namesOtherCity('Family bakery in Harlingen, TX', 'Dallas'), true);
    assert.equal(namesOtherCity('Dallas bakery and breakfast pastries', 'Dallas'), false);
    assert.equal(namesOtherCity('Breakfast tacos on South Congress', 'Austin, TX'), false);
    assert.equal(
      discoveryHitRejection({
        title: 'Harlingen Bakery',
        snippet: 'Family bakery in Harlingen, TX',
        url: 'https://harlingenbakery.example/',
        location: 'Dallas',
        query: 'bakeries in Dallas',
      }),
      'other-city'
    );
    assert.equal(
      discoveryHitRejection({
        title: 'Empire Baking Company',
        snippet: 'Dallas bakery and breakfast pastries',
        url: 'https://empirebaking.com/dallas',
        location: 'Dallas',
        query: 'bakeries in Dallas',
      }),
      null
    );
    assert.equal(
      discoveryHitRejection({
        title: 'Plano Bakery',
        snippet: 'Bakery in Plano, near Dallas',
        url: 'https://planobakery.example/',
        location: 'Dallas, TX',
        query: 'bakeries',
      }),
      null
    );
  });
});
