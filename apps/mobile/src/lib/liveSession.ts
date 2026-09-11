const scrollBySong = new Map<string, number>();

export function rememberLiveScroll(songId: string, y: number) {
  if (!songId || !Number.isFinite(y) || y < 0) return;
  scrollBySong.set(songId, y);
}

export function liveScrollFor(songId: string) {
  return scrollBySong.get(songId) ?? 0;
}

export type LiveQueueKind = 'song' | 'note' | 'timer';

export type LiveQueueEntry<TSong extends { id: string } = { id: string }> = {
  key: string;
  kind: LiveQueueKind;
  title: string;
  artist?: string;
  song?: TSong;
  noteContent?: string;
  timerSeconds?: number;
  itemId?: string;
};

export type LiveSetItemInput = {
  id: string;
  itemType: string;
  songId?: string | null;
  noteContent?: string | null;
  timerSeconds?: number | null;
  overrideCapo?: number | null;
  overrideTranspose?: number | null;
  keyOffset?: number | null;
};

export function queueEntryKey<T extends { key?: string; id?: string }>(row: T): string {
  return row.key || row.id || '';
}

/** Follow a band set from local DB without replacing the chart currently on stage. */
export function mergeFollowQueue<T extends { key?: string; id?: string }>(
  current: T | null,
  incoming: T[],
): { queue: T[]; index: number } {
  if (!current) return { queue: incoming, index: 0 };
  const currentKey = queueEntryKey(current);
  const idx = incoming.findIndex((row) => queueEntryKey(row) === currentKey);
  if (idx < 0) {
    return {
      queue: [current, ...incoming.filter((row) => queueEntryKey(row) !== currentKey)],
      index: 0,
    };
  }
  return {
    queue: incoming.map((row, i) => (i === idx ? current : row)),
    index: idx,
  };
}

export function applyOccurrenceOverrides<
  T extends { capo?: number | null; keyShift?: number | null },
>(song: T, item: LiveSetItemInput): T {
  const capo = item.overrideCapo != null ? item.overrideCapo : song.capo;
  const keyShift =
    item.overrideTranspose != null
      ? item.overrideTranspose
      : item.keyOffset != null
        ? item.keyOffset
        : song.keyShift;
  return { ...song, capo, keyShift };
}

export function buildLiveQueueFromSet<
  TSong extends {
    id: string;
    title: string;
    artist?: string | null;
    capo?: number | null;
    keyShift?: number | null;
  },
>(items: LiveSetItemInput[], songsById: Record<string, TSong>): LiveQueueEntry<TSong>[] {
  const out: LiveQueueEntry<TSong>[] = [];
  for (const item of items) {
    if (item.itemType === 'note') {
      const title = item.noteContent?.trim() || 'Note';
      out.push({
        key: item.id,
        kind: 'note',
        title,
        noteContent: item.noteContent ?? '',
        itemId: item.id,
      });
      continue;
    }
    if (item.itemType === 'timer') {
      const seconds = item.timerSeconds ?? 0;
      out.push({
        key: item.id,
        kind: 'timer',
        title: `${seconds}s break`,
        timerSeconds: seconds,
        itemId: item.id,
      });
      continue;
    }
    if (item.itemType !== 'song' || !item.songId) continue;
    const song = songsById[item.songId];
    if (!song) continue;
    const liveSong = applyOccurrenceOverrides(song, item);
    out.push({
      key: item.id,
      kind: 'song',
      title: liveSong.title,
      artist: liveSong.artist ?? undefined,
      song: liveSong,
      itemId: item.id,
    });
  }
  return out;
}

export function pickLiveIndex<T extends { kind: LiveQueueKind; song?: { id: string } }>(
  queue: T[],
  preferredSongId?: string | null,
  currentSetIndex?: number | null,
): number {
  if (!queue.length) return 0;
  if (
    typeof currentSetIndex === 'number' &&
    currentSetIndex >= 0 &&
    currentSetIndex < queue.length
  ) {
    const at = queue[currentSetIndex];
    if (!preferredSongId || at?.kind !== 'song' || at.song?.id === preferredSongId) {
      return currentSetIndex;
    }
  }
  if (preferredSongId) {
    const found = queue.findIndex((entry) => entry.kind === 'song' && entry.song?.id === preferredSongId);
    if (found >= 0) return found;
  }
  return 0;
}
