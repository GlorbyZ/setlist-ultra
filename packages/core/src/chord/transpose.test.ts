import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  displayChord,
  formatKeyName,
  parseKeyName,
  spellPitch,
  transposeChord,
  transposeKeyName,
} from './transpose';

test('spellPitch never emits Fb E# Cb B#', () => {
  assert.equal(spellPitch('Fb'), 'E');
  assert.equal(spellPitch('E#'), 'F');
  assert.equal(spellPitch('Cb'), 'B');
  assert.equal(spellPitch('B#'), 'C');
});

test('transpose avoids F flat minor / Fbm', () => {
  assert.equal(transposeChord('Fbm', 0), 'Em');
  assert.equal(transposeChord('Gb', -1), 'F');
  assert.equal(transposeChord('F#m', -1), 'Fm');
  assert.equal(transposeKeyName('F flat minor', 0), 'Em');
  assert.equal(transposeKeyName('Gb minor', -1), 'Fm');
  assert.equal(transposeKeyName('F# minor', 2), 'G#m');
  assert.equal(transposeKeyName('Eb minor', 0), 'Ebm');
});

test('slash chords transpose both sides', () => {
  assert.equal(transposeChord('G/B', 2), 'A/C#');
  assert.equal(transposeChord('Bb/F', -1), 'A/E');
});

test('displayChord applies capo toward concert pitch', () => {
  assert.equal(displayChord('G', 2, 0), 'F');
});

test('parse and format key names', () => {
  assert.deepEqual(parseKeyName('F# minor'), { tonic: 'F#', minor: true });
  assert.deepEqual(parseKeyName('Ebm'), { tonic: 'Eb', minor: true });
  assert.equal(formatKeyName('Eb', true), 'Ebm');
});
