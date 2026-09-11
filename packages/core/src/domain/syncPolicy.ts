/** Pure sync policy — no I/O. Used by hosted sync and unit tests. */

export function isLocallyDirty(syncStatus?: string | null, deleted?: number | null): boolean {
  return syncStatus === 'local' || deleted === 1;
}

/** Push only dirty/tombstoned rows. Clean synced rows are identity-only. */
export function shouldPushEntity(syncStatus?: string | null, deleted?: number | null): boolean {
  return isLocallyDirty(syncStatus, deleted);
}

/** Apply remote set items onto an existing local set only when the local set is not dirty. */
export function shouldApplyRemoteSetItems(localSyncStatus?: string | null): boolean {
  return localSyncStatus !== 'local';
}

/**
 * Re-bind remote set items when the local set is clean, or when song slots lost
 * their library join (wipe/login remap). Unlinked slots must not stay stuck
 * behind an incremental checkpoint.
 */
export function shouldRelinkRemoteSetItems(input: {
  localSyncStatus?: string | null;
  hasUnlinkedSongItems?: boolean;
}): boolean {
  if (input.hasUnlinkedSongItems) return true;
  return shouldApplyRemoteSetItems(input.localSyncStatus);
}

/** Notes/timers are fine. Song slots are broken when the join is missing or the song row is gone. */
export function setlistSongSlotIsBroken(
  item: { itemType?: string | null; songId?: string | null },
  liveSongIds: ReadonlySet<string>,
): boolean {
  if (item.itemType === 'note' || item.itemType === 'timer') return false;
  if (!item.songId) return true;
  return !liveSongIds.has(item.songId);
}

/** PostgREST may return a many-to-one embed as an object or a one-row array. */
export function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Record both directions. Last-write-wins on local→remote must not drop earlier remotes. */
export function bindHostedLibrarySong(
  libraryIdBySong: Map<string, string>,
  songByRemoteLibraryId: Map<string, string>,
  localId: string,
  remoteId: string,
) {
  if (!localId || !remoteId) return;
  libraryIdBySong.set(localId, remoteId);
  songByRemoteLibraryId.set(remoteId, localId);
}

export function indexSongsByRemoteLibraryId(
  songs: { id: string; remoteId?: string | null }[],
  into = new Map<string, string>(),
): Map<string, string> {
  for (const song of songs) {
    if (song.remoteId) into.set(song.remoteId, song.id);
  }
  return into;
}

/**
 * Local dirty + different remote hash: keep the current arrangement,
 * store the remote chart as a sibling revision (do not overwrite).
 */
export function isArrangementConflict(
  localDirty: boolean,
  localHash?: string | null,
  remoteHash?: string | null,
): boolean {
  if (!localDirty) return false;
  if (!localHash || !remoteHash) return false;
  return localHash !== remoteHash;
}
