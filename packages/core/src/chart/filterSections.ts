import type { SectionKind, SongDocument } from '../ast/types';

export const CHART_SECTION_KINDS: SectionKind[] = ['verse', 'chorus', 'bridge', 'tab', 'comment', 'unknown'];

export function isChartSectionKind(value: unknown): value is SectionKind {
  return typeof value === 'string' && (CHART_SECTION_KINDS as string[]).includes(value);
}

export function sanitizeHiddenSectionKinds(value: unknown): SectionKind[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isChartSectionKind);
}

export function toggleHiddenSectionKind(hidden: readonly SectionKind[], kind: SectionKind): SectionKind[] {
  return hidden.includes(kind) ? hidden.filter((item) => item !== kind) : [...hidden, kind];
}

/** Drop whole chart sections the musician turned off in Look & Stage. */
export function filterChartSections(
  document: SongDocument,
  hiddenKinds: readonly SectionKind[] | null | undefined,
): SongDocument {
  if (!hiddenKinds?.length) return document;
  const hide = new Set(hiddenKinds);
  const sections = document.sections.filter((section) => !hide.has(section.kind));
  if (sections.length === document.sections.length) return document;
  return { ...document, sections };
}
