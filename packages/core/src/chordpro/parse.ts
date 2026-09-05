import type { ChordSlot, Line, Section, SectionKind, SongDocument } from '../ast/types';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const DIRECTIVE_RE = /^\s*\{([^}:]+)(?::(.*))?\}\s*$/;
const INLINE_CHORD_RE = /\[([^\]]+)\]/g;

function classifySection(label: string): SectionKind {
  const n = label.toLowerCase();
  if (n.includes('chorus') || n === 'ch' || n.startsWith('ch ')) return 'chorus';
  if (n.includes('verse') || n === 'v' || n.startsWith('v ')) return 'verse';
  if (n.includes('bridge')) return 'bridge';
  if (n.includes('tab')) return 'tab';
  if (n.includes('comment') || n === 'c') return 'comment';
  return 'unknown';
}

function parseLyricLine(raw: string): Line {
  const slots: ChordSlot[] = [];
  let lyric = '';
  let last = 0;
  INLINE_CHORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_CHORD_RE.exec(raw))) {
    lyric += raw.slice(last, match.index);
    slots.push({ at: lyric.length, chord: match[1] });
    last = match.index + match[0].length;
  }
  lyric += raw.slice(last);

  if (!slots.length) {
    return { id: uid(), kind: raw.trim() ? 'lyric_only' : 'blank', lyric: raw.trim() ? lyric : undefined };
  }
  if (!lyric.trim()) {
    return { id: uid(), kind: 'chord_only', slots };
  }
  return { id: uid(), kind: 'paired', lyric, slots };
}

export type ChordProMeta = {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  tempo?: number;
  durationSeconds?: number;
  copyright?: string;
};

export function parseChordPro(source: string): { document: SongDocument; meta: ChordProMeta } {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n');
  const meta: ChordProMeta = {};
  const sections: Section[] = [];
  const ctx: { current: Section | null } = { current: null };
  let inTab = false;

  const startSection = (kind: SectionKind, label?: string): Section => {
    ctx.current = { id: uid(), kind, label, lines: [] };
    sections.push(ctx.current);
    return ctx.current;
  };

  const ensureSection = (): Section => {
    if (!ctx.current) return startSection('unknown');
    return ctx.current;
  };

  for (const rawLine of lines) {
    const directive = rawLine.match(DIRECTIVE_RE);
    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const value = (directive[2] ?? '').trim();

      if (name === 'title' || name === 't') {
        meta.title = value;
        continue;
      }
      if (name === 'artist' || name === 'subtitle' || name === 'st' || name === 'su') {
        if (name === 'artist') meta.artist = value;
        else if (!meta.artist) meta.artist = value;
        continue;
      }
      if (name === 'key' || name === 'k') {
        meta.key = value;
        continue;
      }
      if (name === 'capo') {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) meta.capo = n;
        continue;
      }
      if (name === 'tempo') {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) meta.tempo = n;
        continue;
      }
      if (name === 'duration') {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) meta.durationSeconds = n;
        continue;
      }
      if (name === 'copyright') {
        meta.copyright = value;
        continue;
      }
      if (name === 'sot' || name === 'start_of_tab') {
        inTab = true;
        startSection('tab', value || 'Tab');
        continue;
      }
      if (name === 'eot' || name === 'end_of_tab') {
        inTab = false;
        ctx.current = null;
        continue;
      }
      if (name === 'soc' || name === 'start_of_chorus') {
        startSection('chorus', value || 'Chorus');
        continue;
      }
      if (name === 'eoc' || name === 'end_of_chorus') {
        ctx.current = null;
        continue;
      }
      if (name === 'sov' || name === 'start_of_verse') {
        startSection('verse', value || 'Verse');
        continue;
      }
      if (name === 'eov' || name === 'end_of_verse') {
        ctx.current = null;
        continue;
      }
      if (name === 'c' || name === 'comment' || name === 'highlight' || name === 'ci') {
        startSection(classifySection(value || 'Comment'), value || undefined);
        continue;
      }
      if (name === 'meta' && value) {
        continue;
      }
      startSection(classifySection(value || name), value || name);
      continue;
    }

    if (inTab) {
      const section = ensureSection();
      section.kind = 'tab';
      section.lines.push({
        id: uid(),
        kind: rawLine.trim() ? 'lyric_only' : 'blank',
        lyric: rawLine,
      });
      continue;
    }

    if (!rawLine.trim()) {
      if (ctx.current) ctx.current.lines.push({ id: uid(), kind: 'blank' });
      continue;
    }

    ensureSection().lines.push(parseLyricLine(rawLine));
  }

  const document: SongDocument = {
    version: 1,
    sections:
      sections.length > 0
        ? sections
        : [{ id: uid(), kind: 'unknown', lines: [{ id: uid(), kind: 'blank' }] }],
    source: {
      provider: 'chordpro',
      importedAt: new Date().toISOString(),
    },
  };

  return { document, meta };
}
