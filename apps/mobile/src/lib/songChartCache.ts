import type { SongDocument } from '@setlist-ultra/core';
import type { SongRow } from '@setlist-ultra/db';

import { parseSongDocument } from '@/src/lib/repository';

type CacheEntry = { sig: string; doc: SongDocument };

const MAX_ENTRIES = 24;
const cache = new Map<string, CacheEntry>();

function signature(row: { id: string; chordpro?: string | null; contentAst: string; updatedAt?: string }) {
  return `${row.updatedAt ?? ''}|${row.contentAst.length}|${row.chordpro?.length ?? 0}`;
}

/** Parse once per song revision; keep hot for Live neighbor swipes. */
export function getCachedSongDocument(
  row: { id: string; chordpro?: string | null; contentAst: string; updatedAt?: string },
): SongDocument {
  const sig = signature(row);
  const hit = cache.get(row.id);
  if (hit && hit.sig === sig) return hit.doc;
  const doc = parseSongDocument(row);
  cache.set(row.id, { sig, doc });
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest != null) cache.delete(oldest);
  }
  return doc;
}

/** Warm prev/current/next so gallery swipe does not hitch on parse. */
export function warmSongDocuments(rows: Array<SongRow | null | undefined>) {
  for (const row of rows) {
    if (row) getCachedSongDocument(row);
  }
}
