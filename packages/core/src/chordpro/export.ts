import type { Line, Section, SongDocument } from '../ast/types';

function insertChords(lyric: string, slots: { at: number; chord: string }[]): string {
  const sorted = [...slots].sort((a, b) => a.at - b.at);
  let out = '';
  let cursor = 0;
  for (const slot of sorted) {
    const at = Math.max(0, Math.min(lyric.length, slot.at));
    if (at > cursor) {
      out += lyric.slice(cursor, at);
      cursor = at;
    }
    out += `[${slot.chord}]`;
  }
  out += lyric.slice(cursor);
  return out;
}

function exportLine(line: Line): string {
  if (line.kind === 'blank') return '';
  if (line.kind === 'chord_only') {
    return (line.slots ?? []).map((slot) => `[${slot.chord}]`).join(' ');
  }
  const lyric = line.lyric ?? '';
  if (line.slots?.length) return insertChords(lyric, line.slots);
  return lyric;
}

function sectionOpen(section: Section): string[] {
  if (section.kind === 'tab') {
    return [`{sot${section.label && section.label !== 'Tab' ? `: ${section.label}` : ''}}`];
  }
  if (section.label) return [`{c: ${section.label}}`];
  if (section.kind === 'chorus') return ['{c: Chorus}'];
  if (section.kind === 'verse') return ['{c: Verse}'];
  if (section.kind === 'bridge') return ['{c: Bridge}'];
  return [];
}

function sectionClose(section: Section): string[] {
  if (section.kind === 'tab') return ['{eot}'];
  return [];
}

export function documentToChordPro(
  document: SongDocument,
  meta?: {
    title?: string;
    artist?: string;
    key?: string;
    capo?: number;
    tempo?: number;
    copyright?: string;
  },
): string {
  const header: string[] = [];
  if (meta?.title) header.push(`{title: ${meta.title}}`);
  if (meta?.artist) header.push(`{artist: ${meta.artist}}`);
  if (meta?.key) header.push(`{key: ${meta.key}}`);
  if (meta?.capo != null && meta.capo > 0) header.push(`{capo: ${meta.capo}}`);
  if (meta?.tempo) header.push(`{tempo: ${meta.tempo}}`);
  if (meta?.copyright) header.push(`{copyright: ${meta.copyright}}`);

  const body: string[] = [];
  for (const section of document.sections) {
    body.push(...sectionOpen(section));
    for (const line of section.lines) {
      body.push(exportLine(line));
    }
    body.push(...sectionClose(section));
  }

  return [...header, ...(header.length ? [''] : []), ...body].join('\n').replace(/\n+$/, '') + '\n';
}
