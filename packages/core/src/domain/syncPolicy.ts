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
