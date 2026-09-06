const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode HTML entities in UG titles, artists, and lyrics before display or save. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        const code = Number.parseInt(body.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : full;
      }
      if (body.startsWith('#')) {
        const code = Number.parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : full;
      }
      return NAMED[body.toLowerCase()] ?? full;
    })
    .replace(/&#0*39;/g, "'");
}

export function foldUgName(value: string): string {
  return decodeHtmlEntities(value)
    .toLowerCase()
    .replace(/[''`´’‘]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function ugTabIdFromUrl(url: string): string | null {
  const match = url.match(/-(\d+)(?:\/)?(?:[?#]|$)/);
  return match?.[1] ?? null;
}

export function namesLikelyMatch(left: string, right: string): boolean {
  const a = foldUgName(left);
  const b = foldUgName(right);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}
