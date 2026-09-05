/** Songbook Pro chromatic key: 0 = A … 11 = G#. Values outside 0–11 are stored as-is. */

export const SBP_CHROMATIC_KEYS = [
  'A',
  'A#',
  'B',
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
] as const;

export type SbpChromaticKey = (typeof SBP_CHROMATIC_KEYS)[number];

const ENHARMONIC: Record<string, SbpChromaticKey> = {
  A: 'A',
  'A#': 'A#',
  BB: 'A#',
  B: 'B',
  CB: 'B',
  C: 'C',
  'B#': 'C',
  'C#': 'C#',
  DB: 'C#',
  D: 'D',
  'D#': 'D#',
  EB: 'D#',
  E: 'E',
  FB: 'E',
  F: 'F',
  'E#': 'F',
  'F#': 'F#',
  GB: 'F#',
  G: 'G',
  'G#': 'G#',
  AB: 'G#',
};

export function sbpKeyToName(value: number | null | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  if (value >= 0 && value <= 11) return SBP_CHROMATIC_KEYS[value];
  return `key:${value}`;
}

export function keyNameToSbp(name: string | null | undefined): number | null {
  if (!name) return null;
  const trimmed = name.trim();
  const tagged = trimmed.match(/^key:(-?\d+)$/i);
  if (tagged) return Number.parseInt(tagged[1], 10);
  const normalized = trimmed.replace(/♭/g, 'b').replace(/♯/g, '#').toUpperCase();
  const mapped = ENHARMONIC[normalized];
  if (!mapped) return null;
  return SBP_CHROMATIC_KEYS.indexOf(mapped);
}

export function wrapSemitones(semitones: number): number {
  const n = semitones % 12;
  return n < 0 ? n + 12 : n;
}
