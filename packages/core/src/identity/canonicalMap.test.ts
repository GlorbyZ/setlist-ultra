import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compactCanonicalMap, resolveCanonicalRoot } from './canonicalMap';
import { applyPatch } from './patchValue';

test('resolveCanonicalRoot walks B→A→C to C', () => {
  const map = new Map([
    ['B', 'A'],
    ['A', 'C'],
  ]);
  assert.equal(resolveCanonicalRoot(map, 'B'), 'C');
  assert.equal(resolveCanonicalRoot(map, 'A'), 'C');
  assert.equal(resolveCanonicalRoot(map, 'C'), 'C');
});

test('resolveCanonicalRoot stops on a cycle', () => {
  const map = new Map([
    ['A', 'B'],
    ['B', 'A'],
  ]);
  assert.equal(resolveCanonicalRoot(map, 'A'), 'A');
});

test('compactCanonicalMap points every dupe at the surviving root', () => {
  const compact = compactCanonicalMap(
    new Map([
      ['B', 'A'],
      ['A', 'C'],
    ]),
  );
  assert.equal(compact.get('B'), 'C');
  assert.equal(compact.get('A'), 'C');
  assert.equal(compact.has('C'), false);
});

test('applyPatch keeps, clears, and replaces', () => {
  assert.equal(applyPatch(undefined, 'kept'), 'kept');
  assert.equal(applyPatch(null, 'kept'), null);
  assert.equal(applyPatch('next', 'kept'), 'next');
  assert.equal(applyPatch(undefined, null), null);
});
