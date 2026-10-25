import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { museTimeoutMs, openSerpEngineOrder, openSerpEngines, openSerpTimeoutMs } from './serviceTimeouts.ts';

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

  it('defaults Muse to 25s and caps at 60s', () => {
    assert.equal(museTimeoutMs(undefined), 25_000);
    assert.equal(museTimeoutMs('120000'), 60_000);
    assert.equal(museTimeoutMs('nope'), 25_000);
  });
});
