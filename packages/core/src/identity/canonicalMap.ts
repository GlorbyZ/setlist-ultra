/**
 * Follow duplicate → canonical links to the surviving root.
 * Detects cycles and stops on the first repeated id (does not throw).
 */
export function resolveCanonicalRoot(map: Map<string, string>, id: string): string {
  const seen = new Set<string>();
  let current = id;
  while (map.has(current)) {
    if (seen.has(current)) return current;
    seen.add(current);
    current = map.get(current) as string;
  }
  return current;
}

/**
 * Keep the duplicate that appears in setlists. Unused copies are the ones to drop.
 * Equal setlist use (or none) keeps the oldest row.
 */
export function pickCanonicalDuplicate<T extends { id: string; createdAt: string }>(
  group: readonly T[],
  setlistUses: ReadonlyMap<string, number>,
): T {
  if (!group.length) throw new Error('duplicate group is empty');
  return [...group].sort((a, b) => {
    const byUses = (setlistUses.get(b.id) ?? 0) - (setlistUses.get(a.id) ?? 0);
    if (byUses) return byUses;
    return a.createdAt.localeCompare(b.createdAt);
  })[0];
}

/** Compact dupe→canonical so every value is a final root (and drop self-maps). */
export function compactCanonicalMap(map: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const dupe of map.keys()) {
    const root = resolveCanonicalRoot(map, dupe);
    if (root !== dupe) out.set(dupe, root);
  }
  return out;
}
