export type SectionKind =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'tab'
  | 'comment'
  | 'unknown';

export type LineKind = 'paired' | 'lyric_only' | 'chord_only' | 'blank' | 'comment';

export type ChordSlot = {
  at: number;
  chord: string;
  annotation?: string;
};

export type Line = {
  id: string;
  kind: LineKind;
  lyric?: string;
  slots?: ChordSlot[];
};

export type Section = {
  id: string;
  kind: SectionKind;
  label?: string;
  lines: Line[];
  style?: { textColor?: string; highlight?: string };
};

export type SongSource = {
  provider: 'ultimate_guitar' | 'chordpro' | 'manual';
  url?: string;
  importedAt: string;
};

export type SongDocument = {
  version: 1;
  sections: Section[];
  source?: SongSource;
};

export type UgChord = {
  note: string;
  pre_spaces: number;
};

export type UgLine =
  | { type: 'chords'; chords: UgChord[] }
  | { type: 'lyric'; lyric: string }
  | { type: 'blank' };

export type UgTabResponse = {
  tab: {
    title: string;
    artist_name: string;
    author?: string;
    key?: string;
    capo?: string;
    tuning?: string;
    difficulty?: string;
    lines: UgLine[];
  };
};

export type SongMeta = {
  title: string;
  artist: string;
  originalKey?: string;
  capo?: number;
  tempo?: number;
  durationSeconds?: number;
  copyright?: string;
  sourceUrl?: string;
};
