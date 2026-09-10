import { md5 } from '../hash/md5';

/** Identity for a numeric ID inside one imported archive. Never reuse across archives. */
export function archiveSourceKey(
  archiveHash: string,
  entity: 'song' | 'set' | 'item' | 'folder',
  sourceId: number | string,
) {
  return `sbp:${archiveHash}:${entity}:${sourceId}`;
}

export function hashImportBytes(bytes: Uint8Array) {
  const take = Math.min(bytes.byteLength, 1024 * 1024);
  return md5(bytes.subarray(0, take)) + ':' + String(bytes.byteLength);
}
