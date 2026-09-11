import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeFollowQueue } from './liveSession';
import { parseMidiOnLoad, serializeMidiOnLoad } from './midi';

test('mergeFollowQueue keeps the on-stage song row even if the incoming copy changed', () => {
  const current = { id: 'a', title: 'On stage' };
  const incoming = [
    { id: 'b', title: 'Opener' },
    { id: 'a', title: 'Remote edit' },
    { id: 'c', title: 'Closer' },
  ];
  const merged = mergeFollowQueue(current, incoming);
  assert.equal(merged.index, 1);
  assert.equal(merged.queue[1]?.title, 'On stage');
  assert.equal(merged.queue[0]?.title, 'Opener');
  assert.equal(merged.queue[2]?.title, 'Closer');
});

test('mergeFollowQueue pins a removed song until the musician leaves it', () => {
  const current = { id: 'gone', title: 'Still playing' };
  const merged = mergeFollowQueue(current, [{ id: 'next', title: 'Next' }]);
  assert.equal(merged.index, 0);
  assert.equal(merged.queue[0]?.id, 'gone');
  assert.equal(merged.queue[1]?.id, 'next');
});

test('parseMidiOnLoad rejects incomplete or out-of-range payloads', () => {
  assert.equal(parseMidiOnLoad('{"channel":1}'), null);
  assert.equal(parseMidiOnLoad('{"channel":0,"program":1}'), null);
  assert.deepEqual(parseMidiOnLoad(serializeMidiOnLoad({ channel: 1, program: 27 })), {
    channel: 1,
    program: 27,
    note: undefined,
  });
});
