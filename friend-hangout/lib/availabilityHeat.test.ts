import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availabilityRatio,
  availabilityStrong,
  availabilityWord,
  coverageCount,
  parseSlotLabel,
  rangesOverlap,
} from './availabilityHeat.ts';
import type { Friend } from '../types/index.ts';

function friend(id: string, start: string, end: string): Friend {
  return {
    id,
    name: id,
    avatarColor: 'bg-leaf',
    availabilitySlots: [{ id: `${id}-slot`, startTime: start, endTime: end }],
    topInterests: ['food'],
  };
}

describe('availability heat', () => {
  it('scales from none to all', () => {
    assert.equal(availabilityRatio(0, 4), 0);
    assert.equal(availabilityWord(0, 4), 'None');
    assert.equal(availabilityStrong(0, 4), false);
    assert.equal(availabilityWord(2, 4), 'Some');
    assert.equal(availabilityRatio(2, 4), 0.5);
    assert.equal(availabilityWord(4, 4), 'All');
    assert.equal(availabilityStrong(4, 4), true);
    assert.equal(availabilityStrong(1, 1), true);
    assert.equal(availabilityStrong(3, 4), false);
    assert.equal(availabilityStrong(9, 10), false);
  });

  it('counts friends whose windows overlap a slot', () => {
    const friends = [friend('a', '12:00', '17:00'), friend('b', '18:00', '22:00')];
    const afternoon = coverageCount(friends, '12:00', '17:00');
    const evening = coverageCount(friends, '17:00', '22:00');
    const midday = coverageCount(friends, '13:00', '16:00');
    assert.deepEqual(
      { count: afternoon.count, word: afternoon.word },
      { count: 1, word: 'Some' }
    );
    assert.equal(evening.count, 1);
    assert.equal(midday.word, 'Some');
    assert.equal(rangesOverlap('12:00', '17:00', '17:00', '22:00'), false);
  });

  it('reads a plan stop label', () => {
    assert.deepEqual(parseSlotLabel('2:00 PM - 3:30 PM'), { start: '14:00', end: '15:30' });
    assert.equal(parseSlotLabel('later'), null);
  });
});
