import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  storedAutoscrollSeconds,
  storedCapo,
  storedConcertShift,
  storedPerformanceSeconds,
  storedWrittenKey,
} from './musicalFields';
import { assertIdsBelongToSet } from './setScope';

test('musical fields do not infer missing stored values', () => {
  assert.equal(storedWrittenKey('  G  '), 'G');
  assert.equal(storedWrittenKey(''), null);
  assert.equal(storedWrittenKey(undefined), null);
  assert.equal(storedConcertShift(undefined), 0);
  assert.equal(storedCapo(undefined), 0);
  assert.equal(storedPerformanceSeconds(180), 180);
  assert.equal(storedPerformanceSeconds(0), null);
  assert.equal(storedAutoscrollSeconds(undefined), null);
  assert.notEqual(storedAutoscrollSeconds(undefined), storedPerformanceSeconds(90));
});

test('assertIdsBelongToSet rejects items from another set', () => {
  assertIdsBelongToSet(['a', 'b'], ['a', 'b']);
  assert.throws(() => assertIdsBelongToSet(['a', 'x'], ['a', 'b']), /does not belong/);
  assert.throws(() => assertIdsBelongToSet(['a'], ['a', 'b']), /every item/);
});
