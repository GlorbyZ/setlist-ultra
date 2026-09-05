import { Note } from '@tonaljs/tonal';
import type { ChordSlot, SongDocument } from '../ast/types';
import { wrapSemitones } from '../key';

const CHORD_RE = /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|mmaj|m7b5)?[0-9#b/()]*$/i;

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

function prefersFlats(note: string): boolean {
  return /b|♭/.test(note) && !/#|♯/.test(note);
}

/** Guitar-friendly pitch: never Fb / E# / Cb / B#. */
export function spellPitch(note: string, preferFlats = false): string {
  const cleaned = note.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const chroma = Note.chroma(cleaned);
  if (chroma == null) return cleaned;
  const flats = preferFlats || prefersFlats(cleaned);
  return (flats ? FLAT_NOTES : SHARP_NOTES)[wrapSemitones(chroma)];
}

export function transposePitch(note: string, semitones: number, preferFlats = prefersFlats(note)): string {
  const cleaned = note.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const chroma = Note.chroma(cleaned);
  if (chroma == null) return cleaned;
  return spellPitch(SHARP_NOTES[wrapSemitones(chroma + semitones)], preferFlats);
}

function transposeChordToken(token: string, semitones: number): string {
  if (!token || /^n\.?c\.?$/i.test(token)) return token;
  const match = token.match(/^([A-G](?:#|b|♯|♭)?)(.*)$/);
  if (!match) return token;
  return `${transposePitch(match[1], semitones)}${match[2]}`;
}

export function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) {
    if (!chord) return chord;
    return chord.includes('/')
      ? chord.split('/').map((part) => transposeChordToken(part, 0)).join('/')
      : transposeChordToken(chord, 0);
  }
  return chord.split('/').map((part) => transposeChordToken(part, semitones)).join('/');
}

export function parseKeyName(value: string | null | undefined): { tonic: string; minor: boolean } | null {
  if (!value?.trim()) return null;
  let text = value
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/\s+sharp\b/gi, '#')
    .replace(/\s+flat\b/gi, 'b')
    .replace(/\s+/g, ' ')
    .replace(/([A-G]) b\b/i, '$1b');

  const minor = /\b(minor|min)\b/i.test(text) || /^(?:[A-G](?:#|b)?)m$/i.test(text.replace(/\s+/g, ''));
  text = text.replace(/\b(major|maj|minor|min)\b/gi, '').replace(/\s+/g, '');
  const match = text.match(/^([A-G](?:#|b)?)m?$/i);
  if (!match) return null;
  return { tonic: `${match[1][0].toUpperCase()}${match[1].slice(1)}`, minor };
}

export function formatKeyName(tonic: string, minor: boolean): string {
  const note = spellPitch(tonic, prefersFlats(tonic) || (minor && /[b♭]/.test(tonic)));
  return minor ? `${note}m` : note;
}

export function transposeKeyName(value: string | null | undefined, semitones: number): string | undefined {
  const parsed = parseKeyName(value);
  if (!parsed) return value?.trim() || undefined;
  const tonic = transposePitch(parsed.tonic, semitones, prefersFlats(parsed.tonic));
  return formatKeyName(tonic, parsed.minor);
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

/** Display/order matches Songbook Pro chromatic index (0 = A). */
export const KEY_OPTIONS = [
  'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#',
] as const;
