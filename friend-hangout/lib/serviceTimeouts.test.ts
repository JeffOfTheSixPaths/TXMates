import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  museTimeoutMs,
  openSerpEngineOrder,
  openSerpEngines,
  openSerpTimeoutMs,
  searchProvider,
  serpApiKey,
  serpApiBaseUrl,
  serpApiTimeoutMs,
} from './serviceTimeouts.ts';

describe('service timeouts', () => {
  it('defaults OpenSERP to 15s and DuckDuckGo before Bing', () => {
    assert.equal(openSerpTimeoutMs(undefined), 15_000);
    assert.equal(openSerpTimeoutMs('8000'), 8000);
    assert.equal(openSerpTimeoutMs('90000'), 30_000);
    assert.equal(openSerpEngines(undefined), 'duckduckgo,bing');
    assert.equal(openSerpEngines('google, bing'), 'google,bing');
    assert.deepEqual(openSerpEngineOrder(undefined), ['duckduckgo', 'bing']);
    assert.deepEqual(openSerpEngineOrder('bing,duckduckgo'), ['duckduckgo', 'bing']);
    assert.deepEqual(openSerpEngineOrder('google, bing'), ['google', 'bing']);
    assert.deepEqual(openSerpEngineOrder('bing'), ['bing']);
  });

  it('defaults searchProvider to openserp and toggles to serpapi', () => {
    assert.equal(searchProvider(undefined), 'openserp');
    assert.equal(searchProvider(''), 'openserp');
    assert.equal(searchProvider('openserp'), 'openserp');
    assert.equal(searchProvider('serpapi'), 'serpapi');
    assert.equal(searchProvider('SERPAPI'), 'serpapi');
    assert.equal(searchProvider('serp_api'), 'serpapi');
    assert.equal(searchProvider('serp-api'), 'serpapi');
    assert.equal(searchProvider('anything-else'), 'openserp');
  });

  it('resolves SerpAPI config defaults and bounds', () => {
    assert.equal(serpApiKey('test-key-123'), 'test-key-123');
    assert.equal(serpApiKey(undefined), '');
    assert.equal(serpApiBaseUrl(undefined), 'https://serpapi.com/search.json');
    assert.equal(serpApiBaseUrl('https://custom.serpapi.com/search/'), 'https://custom.serpapi.com/search');
    assert.equal(serpApiTimeoutMs(undefined), 15_000);
    assert.equal(serpApiTimeoutMs('5000'), 5000);
    assert.equal(serpApiTimeoutMs('60000'), 30_000);
  });

  it('defaults Muse to 25s and caps at 60s', () => {
    assert.equal(museTimeoutMs(undefined), 25_000);
    assert.equal(museTimeoutMs('120000'), 60_000);
    assert.equal(museTimeoutMs('nope'), 25_000);
  });
});
