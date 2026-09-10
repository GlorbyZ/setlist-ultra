import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseChordPro } from '../chordpro/parse';
import { chartJumpTargets } from './jumpTargets';

test('labeled ChordPro sections become jump targets', () => {
  const { document } = parseChordPro('{c: Verse 1}\n[G]Hello\n{c: Chorus}\n[C]World\n');
  const targets = chartJumpTargets(document);
  assert.equal(targets.length, 2);
  assert.equal(targets[0]?.kind, 'section');
  assert.equal(targets[0]?.label, 'Verse 1');
  assert.equal(targets[1]?.label, 'Chorus');
});

test('UG bracket headers become real sections, not fake chords', () => {
  const { document } = parseChordPro('[Intro]\n[G]Hello\n[Verse 1]\n[C]World\n[Chorus]\n[D]Now\n');
  const targets = chartJumpTargets(document);
  assert.equal(targets.length, 3);
  assert.equal(targets[0]?.kind, 'section');
  assert.equal(targets[0]?.label, 'Intro');
  assert.equal(targets[1]?.label, 'Verse 1');
  assert.equal(targets[2]?.label, 'Chorus');
  assert.equal(document.sections[0]?.kind, 'unknown');
  assert.equal(document.sections[1]?.kind, 'verse');
});

test('plain Verse/Chorus lines still jump', () => {
  const { document } = parseChordPro('Verse 1\n[G]Hello\nChorus\n[C]World\n');
  const targets = chartJumpTargets(document);
  assert.ok(targets.length >= 2);
  assert.match(targets[0]?.label ?? '', /verse/i);
  assert.match(targets[1]?.label ?? '', /chorus/i);
});

test('one unlabeled verse is not a fake jump list', () => {
  const { document } = parseChordPro('[G]Hello there\n[C]World\n');
  assert.equal(chartJumpTargets(document).length, 0);
});
