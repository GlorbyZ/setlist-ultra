import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseChordPro } from '../chordpro/parse';
import { chartJumpTargets } from './jumpTargets';
import {
  filterChartSections,
  sanitizeHiddenSectionKinds,
  toggleHiddenSectionKind,
} from './filterSections';

test('sanitizeHiddenSectionKinds drops unknown values', () => {
  assert.deepEqual(sanitizeHiddenSectionKinds(['tab', 'nope', 'comment']), ['tab', 'comment']);
});

test('toggleHiddenSectionKind adds and removes tab', () => {
  const hidden = toggleHiddenSectionKind([], 'tab');
  assert.deepEqual(hidden, ['tab']);
  assert.deepEqual(toggleHiddenSectionKind(hidden, 'tab'), []);
});

test('filterChartSections hides tab blocks and leaves lyrics', () => {
  const { document } = parseChordPro('{c: Verse}\n[G]Hello\n{sot}\ne|---2---|\n{eot}\n');
  const filtered = filterChartSections(document, ['tab']);
  assert.equal(
    filtered.sections.some((section) => section.kind === 'tab'),
    false,
  );
  assert.ok(filtered.sections.some((section) => section.kind === 'verse' || section.kind === 'unknown' || section.kind === 'comment'));
  assert.equal(
    chartJumpTargets(filtered).some((target) => /tab/i.test(target.label)),
    false,
  );
});

test('filterChartSections with nothing hidden returns the same document', () => {
  const { document } = parseChordPro('{c: Chorus}\n[C]World\n');
  assert.equal(filterChartSections(document, []), document);
});
