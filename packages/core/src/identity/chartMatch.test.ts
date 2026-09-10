import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chartsLikelySame,
  foldArrangementTitle,
  fingerprintNormalizedChart,
  shouldReuseArrangement,
  titlesLikelySame,
} from './chartMatch';

test('foldArrangementTitle ignores version and official suffixes', () => {
  assert.equal(foldArrangementTitle('Wonderwall (ver 3)'), foldArrangementTitle('Wonderwall'));
  assert.equal(foldArrangementTitle('Wonderwall Official'), foldArrangementTitle('Wonderwall'));
  assert.equal(titlesLikelySame("Sweet Child O' Mine", 'Sweet Child O Mine (chords)'), true);
});

test('normalized fingerprints ignore title metadata and extra blank lines', () => {
  const a = '{title: Hello}\n\n[G]Hi there\n';
  const b = '{title: Hello}\n{artist: Band}\n[G]Hi there\n';
  assert.equal(fingerprintNormalizedChart(a), fingerprintNormalizedChart(b));
  assert.equal(chartsLikelySame(a, b), true);
});

test('same title and artist reuse even when hashes differ slightly', () => {
  assert.equal(
    shouldReuseArrangement({
      incomingTitle: 'Wonderwall',
      incomingArtist: 'Oasis',
      incomingChordpro: '{title: Wonderwall}\n[G]Today is gonna be the day\n[C]That they throw it back to you\n',
      existingTitle: 'Wonderwall (ver 2)',
      existingArtist: 'Oasis',
      existingChordpro: '[G]Today is gonna be the day\n[C]That they throw it back to you\n[D]By now you should have somehow\n',
    }),
    true,
  );
});

test('named variants with different vNames stay separate', () => {
  assert.equal(
    shouldReuseArrangement({
      incomingTitle: 'Wonderwall',
      incomingArtist: 'Oasis',
      incomingVariant: 'acoustic',
      incomingChordpro: '[G]Acoustic chart\n',
      existingTitle: 'Wonderwall',
      existingArtist: 'Oasis',
      existingVariant: 'electric',
      existingChordpro: '[E]Electric chart\n',
    }),
    false,
  );
});
