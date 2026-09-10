import assert from 'node:assert/strict';
import { test } from 'node:test';

import { overlayChordLine, parseChordPro } from './parse';
import { normalizeUgTab } from '../ug/normalizer';

test('overlayChordLine inserts chords at the same columns as the source', () => {
  const lyric = overlayChordLine('G          C', 'Hello there world');
  const { document } = parseChordPro(lyric);
  const line = document.sections[0]?.lines.find((row) => row.kind === 'paired');
  assert.ok(line);
  assert.equal(line.lyric, 'Hello there world');
  assert.deepEqual(
    (line.slots ?? []).map((slot) => ({ at: slot.at, chord: slot.chord })),
    [
      { at: 0, chord: 'G' },
      { at: 11, chord: 'C' },
    ],
  );
});

test('two-line UG-style import becomes paired ChordPro', () => {
  const { document } = parseChordPro('G          C\nHello there world\n');
  const line = document.sections[0]?.lines.find((row) => row.kind === 'paired');
  assert.ok(line);
  assert.equal(line.lyric, 'Hello there world');
  assert.equal(line.slots?.[0]?.at, 0);
  assert.equal(line.slots?.[0]?.chord, 'G');
  assert.equal(line.slots?.[1]?.at, 11);
  assert.equal(line.slots?.[1]?.chord, 'C');
});

test('UG pre_spaces is an absolute column, not a gap', () => {
  const { document } = normalizeUgTab({
    tab: {
      title: 'Test',
      artist_name: 'Band',
      lines: [
        {
          type: 'chords',
          chords: [
            { note: 'G', pre_spaces: 0 },
            { note: 'C', pre_spaces: 11 },
          ],
        },
        { type: 'lyric', lyric: 'Hello there world' },
      ],
    },
  });
  const line = document.sections[0]?.lines.find((row) => row.kind === 'paired');
  assert.equal(line?.slots?.[0]?.at, 0);
  assert.equal(line?.slots?.[1]?.at, 11);
});

test('UG [Verse] headers become labeled sections, [G] stays a chord', () => {
  const { document } = normalizeUgTab({
    tab: {
      title: 'Test',
      artist_name: 'Band',
      lines: [
        { type: 'lyric', lyric: '[Intro]' },
        { type: 'chords', chords: [{ note: 'G', pre_spaces: 0 }] },
        { type: 'lyric', lyric: '[Verse 1]' },
        { type: 'chords', chords: [{ note: 'C', pre_spaces: 0 }] },
        { type: 'lyric', lyric: 'Hello' },
      ],
    },
  });
  assert.equal(document.sections.map((section) => section.label).join(','), 'Intro,Verse 1');
  assert.equal(document.sections[1]?.kind, 'verse');
  const hello = document.sections[1]?.lines.find((row) => row.kind === 'paired');
  assert.equal(hello?.lyric, 'Hello');
  assert.equal(hello?.slots?.[0]?.chord, 'C');
});

test('a lone [G] line is a chord, not a section title', () => {
  const { document } = parseChordPro('[G]\nHello\n');
  assert.equal(document.sections.length, 1);
  assert.equal(document.sections[0]?.kind, 'unknown');
  const line = document.sections[0]?.lines.find((row) => row.kind === 'paired' || row.kind === 'chord_only');
  assert.equal(line?.slots?.[0]?.chord, 'G');
});
