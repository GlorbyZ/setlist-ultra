import type { Line, SongDocument } from '../ast/types';
import { sectionLabelFromText } from './sectionLabels';

export type ChartJumpTarget = {
  id: string;
  label: string;
  kind: 'section' | 'line';
  sectionId: string;
};

function isHeaderLyric(line: Line): boolean {
  if (line.kind === 'comment') return true;
  if (line.slots && line.slots.length > 0) {
    if (line.kind === 'chord_only' && line.slots.length === 1) {
      return Boolean(sectionLabelFromText(line.slots[0]?.chord));
    }
    return false;
  }
  return Boolean(sectionLabelFromText(line.lyric));
}

function headerLabel(line: Line): string {
  if (line.kind === 'chord_only' && line.slots?.length === 1) {
    return sectionLabelFromText(line.slots[0]?.chord) || line.slots[0]?.chord || 'Section';
  }
  return sectionLabelFromText(line.lyric) || line.lyric?.trim() || 'Section';
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
        label: headerLabel(line),
      });
    }
  }
  return targets;
}
