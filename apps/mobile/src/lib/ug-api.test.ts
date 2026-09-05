import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupUgResults, parseUgTabUrl, sortUgVersions } from './ug-group';

test('groupUgResults splits songs by name not a shared songId', () => {
  const groups = groupUgResults([
    { title: 'Wonderwall — Oasis', url: 'https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-1', songId: '99' },
    { title: 'Champagne Supernova — Oasis', url: 'https://tabs.ultimate-guitar.com/tab/oasis/champagne-supernova-chords-2', songId: '99' },
    { title: 'Wonderwall — Oasis', url: 'https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-official-3', songId: '99', type: 'Official', rating: 4.8 },
  ]);
  assert.equal(groups.length, 2);
  const wonder = groups.find((group) => group.songName === 'Wonderwall');
  assert.equal(wonder?.versions.length, 2);
  assert.equal(wonder?.versions[0]?.type, 'Official');
});

test('parseUgTabUrl reads artist and song from the path', () => {
  const parsed = parseUgTabUrl('https://tabs.ultimate-guitar.com/tab/radiohead/creep-chords-123');
  assert.equal(parsed.artistName, 'Radiohead');
  assert.equal(parsed.songName, 'Creep');
});

test('sortUgVersions puts official and chords first', () => {
  const sorted = sortUgVersions([
    { title: 'x', url: 'u1', type: 'Video' },
    { title: 'x', url: 'u2', type: 'Chords', rating: 3 },
    { title: 'x', url: 'u3', type: 'Official', rating: 5 },
  ]);
  assert.deepEqual(sorted.map((row) => row.type), ['Official', 'Chords', 'Video']);
});
