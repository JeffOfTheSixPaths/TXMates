import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferActivityCategory, isGeneralPlanQuery } from './activityCategory.ts';
import { isListicleListing } from './musePlan.ts';

const TACO_SNIPPET = 'Yelp users also searched for tacos, restaurants, and food nearby.';

describe('activity category from the listing itself', () => {
  it('files the two real escape-room titles as gaming even when the snippet says tacos', () => {
    const top = inferActivityCategory({
      title: 'TOP 10 BEST Escape Rooms in Austin, TX - Updated 2026',
      snippet: TACO_SNIPPET,
    });
    const absolute = inferActivityCategory({
      title: 'The Absolute Best Escape Rooms in Austin',
      snippet: TACO_SNIPPET,
      query: 'best things to do with friends venues activities',
    });
    assert.equal(top.category, 'gaming');
    assert.equal(top.label, 'Gaming & Arcades');
    assert.equal(absolute.category, 'gaming');
  });

  it('uses a topic query before the snippet when the title is vague', () => {
    const fromQuery = inferActivityCategory({
      title: 'Yelp',
      snippet: TACO_SNIPPET,
      query: 'escape rooms in Austin',
    });
    assert.equal(fromQuery.category, 'gaming');
  });

  it('classifies a barbecue joint, a park, a museum, a bar, and a cafe from their own names', () => {
    assert.equal(inferActivityCategory({ title: 'Franklin Barbecue', snippet: TACO_SNIPPET }).category, 'food');
    assert.equal(inferActivityCategory({ title: 'Zilker Park' }).category, 'outdoors');
    assert.equal(inferActivityCategory({ title: 'Museum of Fine Arts, Houston' }).category, 'arts');
    assert.equal(inferActivityCategory({ title: 'Anvil Bar & Refuge', snippet: 'tacos nearby' }).category, 'nightlife');
    assert.equal(inferActivityCategory({ title: "Mozart's Coffee Roasters" }).category, 'chill');
  });

  it('does not let a food interest or a food word inside games win', () => {
    assert.equal(
      inferActivityCategory({
        title: 'The Escape Game Austin',
        snippet: 'arcade games and tacos',
        query: 'escape room',
      }).category,
      'gaming'
    );
    assert.equal(inferActivityCategory({ title: 'Pinballz Kingdom', snippet: 'hundreds of games' }).category, 'gaming');
  });

  it('treats city-wide browse as general and topic searches as narrow', () => {
    assert.equal(isGeneralPlanQuery(''), true);
    assert.equal(isGeneralPlanQuery('Houston, TX best things to do with friends venues activities'), true);
    assert.equal(isGeneralPlanQuery('Austin, TX food'), true);
    assert.equal(isGeneralPlanQuery('tacos in Houston'), false);
    assert.equal(isGeneralPlanQuery('donuts in Dallas'), false);
    assert.equal(isGeneralPlanQuery('escape room in Austin'), false);
  });

  it('catches listicles, magazine suffixes, and yelp or youtube search pages', () => {
    assert.equal(isListicleListing('The Best Tacos in Houston'), true);
    assert.equal(isListicleListing('Best donuts in Dallas'), true);
    assert.equal(isListicleListing('The Absolute Best Escape Rooms in Austin'), true);
    assert.equal(isListicleListing('TOP 10 BEST Escape Rooms in Austin, TX - Updated 2026'), true);
    assert.equal(isListicleListing('Pecan Lodge | Houstonia Magazine'), true);
    assert.equal(isListicleListing('Franklin Barbecue', 'https://www.yelp.com/search?find_desc=bbq'), true);
    assert.equal(isListicleListing('Franklin Barbecue', 'https://www.youtube.com/watch?v=abc'), true);
    assert.equal(isListicleListing('Franklin Barbecue', 'https://franklinbarbecue.com'), false);
    assert.equal(isListicleListing('Topgolf Austin'), false);
    assert.equal(isListicleListing('Novel Escape | Top-Rated Escape Rooms in Austin, TX'), true);
    assert.equal(isListicleListing('Top Rated Escape Rooms in Dallas, TX'), true);
    assert.equal(isListicleListing('Escape Rooms in Austin, TX'), true);
    assert.equal(isListicleListing('The Escape Game Austin'), false);
  });
});
