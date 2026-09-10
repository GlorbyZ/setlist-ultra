import type { SectionKind } from '../ast/types';

/** Same titles SBP/UG use for “smart sections”. */
const SECTION_LEAD_RE =
  /^(verse|chorus|bridge|intro|outro|solo|pre[- ]?chorus|post[- ]?chorus|tag|instrumental|interlude|ending|coda|vamp|break|refrain|hook|riff)\b/i;

const CHORDISH_RE =
  /^(?:[A-G][#b]?(?:maj7|maj|min|m|sus[24]?|dim|aug|add[0-9]|[0-9]|°|ø)*(?:\/[A-G][#b]?)?|N\.?C\.?)$/i;

export function classifySectionKind(label: string): SectionKind {
  const n = label.toLowerCase();
  if (n.includes('chorus') || n === 'ch' || n.startsWith('ch ')) return 'chorus';
  if (n.includes('verse') || n === 'v' || n.startsWith('v ')) return 'verse';
  if (n.includes('bridge')) return 'bridge';
  if (n.includes('tab')) return 'tab';
  if (n.includes('comment') || n === 'c') return 'comment';
  return 'unknown';
}

/**
 * UG wiki titles sections as `[Verse 1]`. ChordPro uses the same brackets for chords,
 * so only accept a whole-line label that is not a chord token.
 */
export function sectionLabelFromText(raw: string | null | undefined): string | null {
  let text = String(raw ?? '').trim();
  if (!text || text.length > 48) return null;
  const wrapped = text.match(/^\[([^\]]+)\]$/);
  if (wrapped) text = wrapped[1].trim();
  text = text.replace(/[:.\-–—]+\s*$/u, '').trim();
  if (!text || CHORDISH_RE.test(text)) return null;
  if (!SECTION_LEAD_RE.test(text)) return null;
  return text;
}
