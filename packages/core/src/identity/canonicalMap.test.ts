import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compactCanonicalMap, pickCanonicalDuplicate, resolveCanonicalRoot } from './canonicalMap';
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

test('pickCanonicalDuplicate keeps the copy that is in a setlist', () => {
  const kept = pickCanonicalDuplicate(
    [
      { id: 'old-unused', createdAt: '2020-01-01' },
      { id: 'in-set', createdAt: '2024-01-01' },
    ],
    new Map([['in-set', 3]]),
  );
  assert.equal(kept.id, 'in-set');
});

test('pickCanonicalDuplicate prefers more setlist uses, then oldest', () => {
  const uses = new Map([
    ['a', 1],
    ['b', 4],
    ['c', 4],
  ]);
  assert.equal(
    pickCanonicalDuplicate(
      [
        { id: 'a', createdAt: '2020-01-01' },
        { id: 'c', createdAt: '2021-01-01' },
        { id: 'b', createdAt: '2022-01-01' },
      ],
      uses,
    ).id,
    'c',
  );
  assert.equal(
    pickCanonicalDuplicate(
      [
        { id: 'newer', createdAt: '2024-01-01' },
        { id: 'older', createdAt: '2020-01-01' },
      ],
      new Map(),
    ).id,
    'older',
  );
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
