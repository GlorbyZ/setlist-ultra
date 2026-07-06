import type { ChordSlot, Line, Section, SongDocument, UgLine, UgTabResponse } from '../ast/types';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function chordsToSlots(chords: { note: string; pre_spaces: number }[], lyric?: string): ChordSlot[] {
  if (!chords.length) return [];

  let position = 0;
  const slots: ChordSlot[] = [];

  for (const chord of chords) {
    position += chord.pre_spaces;
    slots.push({ at: position, chord: chord.note });
    position += 1;
  }

  if (lyric) {
    return slots.filter((slot) => slot.at <= lyric.length);
  }

  return slots;
}

function pairUgLines(lines: UgLine[]): Line[] {
  const result: Line[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];

    if (current.type === 'blank') {
      result.push({ id: uid(), kind: 'blank' });
      i += 1;
      continue;
    }

    if (current.type === 'lyric') {
      result.push({ id: uid(), kind: 'lyric_only', lyric: current.lyric });
      i += 1;
      continue;
    }

    const next = lines[i + 1];
    if (next?.type === 'lyric') {
      result.push({
        id: uid(),
        kind: 'paired',
        lyric: next.lyric,
        slots: chordsToSlots(current.chords, next.lyric),
      });
      i += 2;
      continue;
    }

    result.push({
      id: uid(),
      kind: 'chord_only',
      slots: chordsToSlots(current.chords),
    });
    i += 1;
  }

  return result;
}

export function normalizeUgTab(response: UgTabResponse, sourceUrl?: string): {
  document: SongDocument;
  meta: {
    title: string;
    artist: string;
    originalKey?: string;
    capo?: number;
    sourceUrl?: string;
  };
} {
  const { tab } = response;
  const lines = pairUgLines(tab.lines ?? []);

  const document: SongDocument = {
    version: 1,
    sections: [
      {
        id: uid(),
        kind: 'unknown',
        lines,
      },
    ],
    source: {
      provider: 'ultimate_guitar',
      url: sourceUrl,
      importedAt: new Date().toISOString(),
    },
  };

  const capo = tab.capo ? Number.parseInt(tab.capo, 10) : undefined;

  return {
    document,
    meta: {
      title: tab.title || 'Untitled',
      artist: tab.artist_name || 'Unknown Artist',
      originalKey: tab.key,
      capo: Number.isFinite(capo) ? capo : undefined,
      sourceUrl,
    },
  };
}

export function documentToPlainText(document: SongDocument): string {
  return document.sections
    .flatMap((section) => section.lines)
    .map((line) => {
      if (line.kind === 'blank') return '';
      if (line.kind === 'chord_only') {
        return (line.slots ?? []).map((s) => s.chord).join(' ');
      }
      return line.lyric ?? '';
    })
    .join('\n');
}

export function createEmptyDocument(title?: string): SongDocument {
  return {
    version: 1,
    sections: [
      {
        id: uid(),
        kind: 'verse',
        label: title,
        lines: [{ id: uid(), kind: 'lyric_only', lyric: '' }],
      },
    ],
    source: {
      provider: 'manual',
      importedAt: new Date().toISOString(),
    },
  };
}
