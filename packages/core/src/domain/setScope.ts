/** Reorder/replace may only touch items that already belong to the target setlist. */
export function assertIdsBelongToSet(orderedIds: string[], setItemIds: string[]): void {
  if (orderedIds.length !== setItemIds.length) {
    throw new Error('Reorder must include every item in the set');
  }
  const allowed = new Set(setItemIds);
  for (const id of orderedIds) {
    if (!allowed.has(id)) throw new Error('Set item does not belong to this setlist');
  }
}
