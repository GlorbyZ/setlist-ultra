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

test('single-section UG-style headers jump by line', () => {
  const { document } = parseChordPro('Verse 1\n[G]Hello\nChorus\n[C]World\n');
  const targets = chartJumpTargets(document);
  assert.ok(targets.length >= 2);
  assert.equal(targets[0]?.kind, 'line');
  assert.match(targets[0]?.label ?? '', /verse/i);
  assert.match(targets[1]?.label ?? '', /chorus/i);
});

test('one unlabeled verse is not a fake jump list', () => {
  const { document } = parseChordPro('[G]Hello there\n[C]World\n');
  assert.equal(chartJumpTargets(document).length, 0);
});
