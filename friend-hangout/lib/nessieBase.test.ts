import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { nessieBaseUrl, nessieCheckUrl } from './nessieServer.ts';

describe('nessie base url', () => {
  const previous = process.env.NESSIE_BASE_URL;

  after(() => {
    if (previous === undefined) delete process.env.NESSIE_BASE_URL;
    else process.env.NESSIE_BASE_URL = previous;
  });

  it('defaults to https and honors NESSIE_BASE_URL', () => {
    delete process.env.NESSIE_BASE_URL;
    assert.equal(nessieBaseUrl(), 'https://api.nessieisreal.com');
    assert.equal(nessieCheckUrl('demo-key'), 'https://api.nessieisreal.com/merchants?key=demo-key');
    process.env.NESSIE_BASE_URL = 'http://example.test/';
    assert.equal(nessieBaseUrl(), 'http://example.test');
    assert.equal(nessieCheckUrl('demo-key'), 'http://example.test/merchants?key=demo-key');
  });
});
