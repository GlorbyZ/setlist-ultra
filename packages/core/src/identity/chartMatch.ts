import { fingerprintContent } from '../hash/md5';
import { foldUgName, namesLikelyMatch } from '../html/entities';

const META_DIRECTIVE =
  /^\s*\{(?:title|t|artist|subtitle|st|album|year|duration|tempo|key|capo|time|copyright)[:\s]/i;
const PLACEHOLDER = /transcribe this chart|scanned|^\{c:\s*scanned\}/i;

/** Title used for library matching: ignores (ver 3), Official, Acoustic, etc. */
export function foldArrangementTitle(title: string): string {
  return foldUgName(title)
    .replace(/\bver(?:sion)?\s*\d+\b/g, '')
    .replace(/\b(?:official|acoustic|live|radio edit|chords|tab|solo)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titlesLikelySame(left: string, right: string): boolean {
  const a = foldArrangementTitle(left);
  const b = foldArrangementTitle(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function normalizeChartBody(chordpro: string): string {
  return (chordpro || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !META_DIRECTIVE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function fingerprintNormalizedChart(chordpro: string): string {
  return fingerprintContent(normalizeChartBody(chordpro));
}

export function chartBodyIsEmpty(chordpro: string): boolean {
  const body = normalizeChartBody(chordpro);
  return !body || PLACEHOLDER.test(body);
}

export function chartsLikelySame(left: string, right: string): boolean {
  if (chartBodyIsEmpty(left) || chartBodyIsEmpty(right)) return true;
  const a = normalizeChartBody(left);
  const b = normalizeChartBody(right);
  if (a === b) return true;
  if (fingerprintContent(a) === fingerprintContent(b)) return true;
  const linesA = new Set(
    a
      .toLowerCase()
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  );
  const linesB = new Set(
    b
      .toLowerCase()
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  );
  if (!linesA.size || !linesB.size) return true;
  let overlap = 0;
  for (const line of linesA) if (linesB.has(line)) overlap += 1;
  return overlap / Math.min(linesA.size, linesB.size) >= 0.45;
}

/** Reuse the existing library song unless both sides are named as different variants. */
export function shouldReuseArrangement(input: {
  incomingTitle: string;
  incomingArtist?: string | null;
  incomingVariant?: string | null;
  incomingChordpro: string;
  existingTitle: string;
  existingArtist?: string | null;
  existingVariant?: string | null;
  existingChordpro: string;
}): boolean {
  if (!titlesLikelySame(input.incomingTitle, input.existingTitle)) return false;
  const incomingArtist = foldUgName(input.incomingArtist || '');
  const existingArtist = foldUgName(input.existingArtist || '');
  if (incomingArtist && existingArtist && !namesLikelyMatch(input.incomingArtist || '', input.existingArtist || '')) {
    return false;
  }
  const incomingVariant = foldUgName(input.incomingVariant || '');
  const existingVariant = foldUgName(input.existingVariant || '');
  if (incomingVariant && existingVariant && incomingVariant !== existingVariant) return false;
  if (chartsLikelySame(input.incomingChordpro, input.existingChordpro)) return true;
  return !incomingVariant && !existingVariant;
}
