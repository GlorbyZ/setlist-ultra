import type { SongDocument } from '@setlist-ultra/core';

export const LOOK_PREVIEW_CHART: SongDocument = {
  version: 1,
  sections: [
    {
      id: 'v1',
      kind: 'verse',
      label: 'Verse 1',
      lines: [
        {
          id: 'l1',
          kind: 'paired',
          lyric: "Josie's on a vacation far away",
          slots: [
            { at: 0, chord: 'C#m' },
            { at: 24, chord: 'B' },
          ],
        },
        {
          id: 'l2',
          kind: 'paired',
          lyric: 'Come around and talk it over',
          slots: [{ at: 0, chord: 'A' }],
        },
      ],
    },
    {
      id: 'c1',
      kind: 'chorus',
      label: 'Chorus',
      lines: [
        {
          id: 'l3',
          kind: 'paired',
          lyric: 'I just wanna use your love tonight',
          slots: [{ at: 0, chord: 'C#m' }],
        },
      ],
    },
    {
      id: 't1',
      kind: 'tab',
      label: 'Tab',
      lines: [{ id: 'l4', kind: 'lyric_only', lyric: 'e|---2---|' }],
    },
  ],
};
