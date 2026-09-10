/**
 * Patch semantics for persisted fields:
 * - undefined → keep previous
 * - null → clear
 * - value → replace
 */
export function applyPatch<T>(next: T | null | undefined, previous: T | null | undefined): T | null {
  if (next === undefined) return previous ?? null;
  return next;
}
