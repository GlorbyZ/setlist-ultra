import { Interval, Note } from '@tonaljs/tonal';
import type { ChordSlot, SongDocument } from '../ast/types';

const CHORD_RE = /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|mmaj|m7b5)?[0-9#b/()]*$/i;

function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) return chord;
  const rootMatch = chord.match(/^([A-G](?:#|b)?)/);
  if (!rootMatch) return chord;

  const root = rootMatch[1];
  const suffix = chord.slice(root.length);
  const transposed = Note.transpose(root, Interval.fromSemitones(semitones));
  if (!transposed) return chord;
  return `${transposed}${suffix}`;
}

export function transposeSlots(slots: ChordSlot[] | undefined, semitones: number): ChordSlot[] | undefined {
  if (!slots || semitones === 0) return slots;
  return slots.map((slot) => ({
    ...slot,
    chord: transposeChord(slot.chord, semitones),
  }));
}

export function transposeDocument(document: SongDocument, semitones: number): SongDocument {
  if (semitones === 0) return document;

  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        slots: transposeSlots(line.slots, semitones),
      })),
    })),
  };
}

export function displayChord(chord: string, capo: number, semitones: number): string {
  const capoSemitones = capo > 0 ? -capo : 0;
  return transposeChord(chord, semitones + capoSemitones);
}

export function isLikelyChord(token: string): boolean {
  return CHORD_RE.test(token.trim());
}

export const KEY_OPTIONS = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;
