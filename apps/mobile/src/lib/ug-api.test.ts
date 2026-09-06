import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupUgResults, mergeUgHits, parseUgTabUrl, sortUgVersions } from './ug-group';

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

test('rankUgGroups prefers higher rating then popularity and splits artists', () => {
  const groups = groupUgResults([
    { title: 'Stay — Rihanna', url: 'https://tabs.ultimate-guitar.com/tab/rihanna/stay-chords-1', rating: 4.2, popularity: 10 },
    { title: 'Stay — The Kid LAROI', url: 'https://tabs.ultimate-guitar.com/tab/the-kid-laroi/stay-chords-2', rating: 4.9, popularity: 80 },
    { title: 'Stay — Rihanna', url: 'https://tabs.ultimate-guitar.com/tab/rihanna/stay-official-3', rating: 4.8, type: 'Official' },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.artistName, 'The Kid LAROI');
  assert.equal(groups.find((g) => g.artistName === 'Rihanna')?.versions.length, 2);
});

test('mergeUgHits appends unique urls without collapsing artists', () => {
  const merged = mergeUgHits(
    [{ title: 'Stay — Rihanna', url: 'https://tabs.ultimate-guitar.com/tab/rihanna/stay-chords-1' }],
    [
      { title: 'Stay — Rihanna', url: 'https://tabs.ultimate-guitar.com/tab/rihanna/stay-chords-1' },
      { title: 'Stay — The Kid LAROI', url: 'https://tabs.ultimate-guitar.com/tab/the-kid-laroi/stay-chords-2' },
    ],
  );
  const groups = groupUgResults(merged);
  assert.equal(merged.length, 2);
  assert.equal(groups.length, 2);
});

test('sortUgVersions puts official and chords first', () => {
  const sorted = sortUgVersions([
    { title: 'x', url: 'u1', type: 'Video' },
    { title: 'x', url: 'u2', type: 'Chords', rating: 3 },
    { title: 'x', url: 'u3', type: 'Official', rating: 5 },
  ]);
  assert.deepEqual(sorted.map((row) => row.type), ['Official', 'Chords', 'Video']);
});
