import { useCallback, useEffect, useState } from 'react';

import {
  getAppState,
  getSetlistItems,
  getSong,
  patchAppState,
} from '@/src/lib/repository';
import { useLibrary } from '@/src/providers/LibraryProvider';
import type { SongRow } from '@setlist-ultra/db';

export function useLiveQueue(preferredSongId?: string) {
  const { songs } = useLibrary();
  const [queue, setQueue] = useState<SongRow[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = await getAppState();
      let list: SongRow[] = songs;
      let nextIndex = 0;

      if (state.currentSetlistId) {
        const items = await getSetlistItems(state.currentSetlistId);
        const rows = await Promise.all(
          items.filter((item) => item.itemType === 'song' && item.songId).map((item) => getSong(item.songId as string)),
        );
        list = rows.filter(Boolean) as SongRow[];
        const preferred = preferredSongId ?? state.currentSongId;
        const fromPreferred = preferred ? list.findIndex((song) => song.id === preferred) : -1;
        nextIndex = fromPreferred >= 0 ? fromPreferred : Math.min(list.length - 1, Math.max(0, state.currentSetIndex ?? 0));
      } else {
        const preferred = preferredSongId ?? state.currentSongId ?? songs[0]?.id;
        nextIndex = Math.max(0, list.findIndex((song) => song.id === preferred));
      }

      if (cancelled) return;
      setQueue(list);
      setIndex(list.length ? nextIndex : 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [preferredSongId, songs]);

  const song = queue[index] ?? null;

  const go = useCallback(
    (dir: -1 | 1) => {
      const next = index + dir;
      const target = queue[next];
      if (!target) return;
      setIndex(next);
      void patchAppState({ currentSongId: target.id, currentSetIndex: next });
    },
    [index, queue],
  );

  return { queue, index, song, loading, go };
}
