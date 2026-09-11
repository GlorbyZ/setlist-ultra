import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildLiveQueueFromSet,
  mergeFollowQueue,
  pickLiveIndex,
} from './liveSession';
import { midiOutputsAvailable, parseMidiOnLoad, serializeMidiOnLoad } from './midi';
import { isPublicServiceUrl, isUsableHttpUrl, sanitizeConfigValue } from './configValidate';

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

test('mergeFollowQueue matches repeated songs by occurrence key', () => {
  const current = { id: 'song-a', key: 'item-2', title: 'Second time' };
  const incoming = [
    { id: 'song-a', key: 'item-1', title: 'First' },
    { id: 'song-a', key: 'item-2', title: 'Changed' },
    { id: 'song-b', key: 'item-3', title: 'Other' },
  ];
  const merged = mergeFollowQueue(current, incoming);
  assert.equal(merged.index, 1);
  assert.equal(merged.queue[1]?.title, 'Second time');
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

test('midiOutputsAvailable is false in node tests without Web MIDI', () => {
  assert.equal(midiOutputsAvailable(), false);
});

test('buildLiveQueueFromSet keeps notes, timers, and duplicate song occurrences', () => {
  const songs = {
    a: { id: 'a', title: 'Wonderwall', artist: 'Oasis', capo: 0, keyShift: 0 },
  };
  const queue = buildLiveQueueFromSet(
    [
      { id: 'i1', itemType: 'song', songId: 'a', overrideCapo: 2 },
      { id: 'i2', itemType: 'note', noteContent: 'Talk to crowd' },
      { id: 'i3', itemType: 'timer', timerSeconds: 30 },
      { id: 'i4', itemType: 'song', songId: 'a', overrideTranspose: 3 },
    ],
    songs,
  );
  assert.equal(queue.length, 4);
  assert.equal(queue[0]?.key, 'i1');
  assert.equal(queue[0]?.song?.capo, 2);
  assert.equal(queue[1]?.kind, 'note');
  assert.equal(queue[2]?.kind, 'timer');
  assert.equal(queue[3]?.key, 'i4');
  assert.equal(queue[3]?.song?.keyShift, 3);
  assert.equal(queue[0]?.song?.id, queue[3]?.song?.id);
  assert.notEqual(queue[0]?.key, queue[3]?.key);
});

test('pickLiveIndex prefers set index for a repeated song', () => {
  const queue = [
    { kind: 'song' as const, song: { id: 'a' } },
    { kind: 'note' as const },
    { kind: 'song' as const, song: { id: 'a' } },
  ];
  assert.equal(pickLiveIndex(queue, 'a', 2), 2);
  assert.equal(pickLiveIndex(queue, 'a', 0), 0);
  assert.equal(pickLiveIndex(queue, 'missing', 1), 1);
});

test('sanitizeConfigValue drops unresolved Expo placeholders', () => {
  assert.equal(sanitizeConfigValue('${EXPO_PUBLIC_SUPABASE_URL}'), '');
  assert.equal(sanitizeConfigValue('https://ug.bigzay.com'), 'https://ug.bigzay.com');
  assert.equal(isUsableHttpUrl('${EXPO_PUBLIC_UG_PROXY_URL}'), false);
  assert.equal(isPublicServiceUrl('http://localhost:3848'), false);
  assert.equal(isPublicServiceUrl('https://ug.bigzay.com'), true);
});
