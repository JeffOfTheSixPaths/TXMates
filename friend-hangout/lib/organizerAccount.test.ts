import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseInviteInput } from './organizerAccount.ts';

describe('parseInviteInput', () => {
  it('reads a full availability URL, including a mate query', () => {
    assert.deepEqual(
      parseInviteInput('https://example.com/avail/txmates-demo?mate=f-2'),
      { id: 'txmates-demo', mate: 'f-2' }
    );
  });

  it('reads a path or a bare hangout id', () => {
    assert.deepEqual(parseInviteInput('/avail/weekend-crew'), { id: 'weekend-crew' });
    assert.deepEqual(parseInviteInput('  weekend-crew  '), { id: 'weekend-crew' });
  });

  it('rejects an empty or unrelated value', () => {
    assert.equal(parseInviteInput(''), null);
    assert.equal(parseInviteInput('not a link'), null);
    assert.equal(parseInviteInput('https://example.com/plan'), null);
  });
});
