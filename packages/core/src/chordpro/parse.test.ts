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
