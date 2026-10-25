import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { nessieBaseUrl } from './nessieServer.ts';

describe('nessie base url', () => {
  const previous = process.env.NESSIE_BASE_URL;

  after(() => {
    if (previous === undefined) delete process.env.NESSIE_BASE_URL;
    else process.env.NESSIE_BASE_URL = previous;
  });

  it('defaults to https and honors NESSIE_BASE_URL', () => {
    delete process.env.NESSIE_BASE_URL;
    assert.equal(nessieBaseUrl(), 'https://api.nessieisreal.com');
    process.env.NESSIE_BASE_URL = 'http://example.test/';
    assert.equal(nessieBaseUrl(), 'http://example.test');
  });
});
