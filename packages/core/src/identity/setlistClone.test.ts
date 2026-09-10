import assert from 'node:assert/strict';
import { test } from 'node:test';

import { setlistCloneSignature } from './setlistClone';

test('setlistCloneSignature matches only title + ordered items', () => {
  const items = [
    { itemType: 'song', songId: 'a' },
    { itemType: 'note', noteContent: 'break' },
  ];
  const a = setlistCloneSignature('Friday Gig', items);
  const b = setlistCloneSignature(' friday gig ', items);
  const c = setlistCloneSignature('Friday Gig', [{ itemType: 'song', songId: 'b' }]);
  const d = setlistCloneSignature('Saturday Gig', items);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});
