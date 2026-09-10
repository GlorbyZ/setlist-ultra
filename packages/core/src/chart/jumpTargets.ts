import type { Line, SongDocument } from '../ast/types';

export type ChartJumpTarget = {
  id: string;
  label: string;
  kind: 'section' | 'line';
  sectionId: string;
};

const HEADER_RE =
  /^(verse|chorus|bridge|intro|outro|solo|pre[- ]?chorus|tag|instrumental|interlude|ending|coda|vamp|break|refrain|hook)\b/i;

function isHeaderLyric(line: Line): boolean {
  const text = line.lyric?.trim() ?? '';
  if (!text || text.length > 40) return false;
  if (line.slots && line.slots.length > 0) return false;
  if (line.kind === 'comment') return true;
  return HEADER_RE.test(text);
}

function sectionHasBody(section: SongDocument['sections'][number]): boolean {
  return section.lines.some((line) => line.kind !== 'blank');
}

/**
 * Jump points for Live “next section”.
 * Prefer real ChordPro sections when there are two or more.
 * UG dumps are often one blob — then scan Verse/Chorus-style header lines.
 */
export function chartJumpTargets(document: SongDocument): ChartJumpTarget[] {
  const bodySections = document.sections.filter(sectionHasBody);
  if (bodySections.length > 1) {
    return bodySections.map((section) => ({
      id: section.id,
      sectionId: section.id,
      kind: 'section' as const,
      label: section.label?.trim() || section.kind,
    }));
  }

  const targets: ChartJumpTarget[] = [];
  for (const section of document.sections) {
    for (const line of section.lines) {
      if (!isHeaderLyric(line)) continue;
      targets.push({
        id: line.id,
        sectionId: section.id,
        kind: 'line',
        label: line.lyric?.trim() || 'Section',
      });
    }
  }
  return targets;
}
