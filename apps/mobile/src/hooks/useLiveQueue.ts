import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { isNativeDbDead, recoverDatabase } from '@/src/lib/db';
import {
  getAppState,
  getSetlist,
  getSetlistItems,
  getSong,
  getSongsByIds,
  patchAppState,
} from '@/src/lib/repository';
import { useLibrary } from '@/src/providers/LibraryProvider';
import type { SongRow } from '@setlist-ultra/db';

export type LiveSetContext = {
  id: string;
  title: string;
  eventDate: string | null;
};

export function useLiveQueue(preferredSongId?: string) {
  const { songs } = useLibrary();
  const [queue, setQueue] = useState<SongRow[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setContext, setSetContext] = useState<LiveSetContext | null>(null);

  const reload = useCallback(async () => {
    const load = async () => {
      const state = await getAppState();
      let list: SongRow[] = songs;
      let nextIndex = 0;
      let nextSet: LiveSetContext | null = null;

      if (state.currentSetlistId) {
        const setRow = await getSetlist(state.currentSetlistId);
        if (setRow) {
          nextSet = { id: setRow.id, title: setRow.title, eventDate: setRow.eventDate ?? null };
        }
        const items = await getSetlistItems(state.currentSetlistId);
        const songIds = items
          .filter((item) => item.itemType === 'song' && item.songId)
          .map((item) => item.songId as string);
        list = await getSongsByIds(songIds);
        const preferred = preferredSongId ?? state.currentSongId;
        const fromPreferred = preferred ? list.findIndex((song) => song.id === preferred) : -1;
        nextIndex =
          fromPreferred >= 0
            ? fromPreferred
            : Math.min(Math.max(0, state.currentSetIndex ?? 0), Math.max(0, list.length - 1));
      } else {
        const preferred = preferredSongId ?? state.currentSongId;
        if (preferred) {
          const fromLibrary = songs.find((song) => song.id === preferred);
          const row = fromLibrary ?? (await getSong(preferred));
          list = fromLibrary ? songs : row ? [row, ...songs.filter((song) => song.id !== row.id)] : songs;
          nextIndex = Math.max(0, list.findIndex((song) => song.id === preferred));
        } else {
          list = songs;
          nextIndex = 0;
        }
      }

      setQueue(list);
      setIndex(list.length ? nextIndex : 0);
      setSetContext(nextSet);
    };

    try {
      await load();
    } catch (error) {
      console.error('Live queue failed:', error);
      if (isNativeDbDead(error)) {
        try {
          await recoverDatabase();
          await load();
        } catch (retryError) {
          console.error('Live queue retry failed:', retryError);
          setQueue([]);
          setIndex(0);
          setSetContext(null);
        }
      } else {
        setQueue([]);
        setIndex(0);
        setSetContext(null);
      }
    } finally {
      setLoading(false);
    }
  }, [preferredSongId, songs]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void reloadRef.current();
    }, []),
  );

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

  const goTo = useCallback(
    (nextIndex: number) => {
      const target = queue[nextIndex];
      if (!target) return;
      setIndex(nextIndex);
      void patchAppState({ currentSongId: target.id, currentSetIndex: nextIndex });
    },
    [queue],
  );

  return {
    queue,
    index,
    song,
    loading,
    go,
    goTo,
    reload,
    setContext,
    hasSetContext: Boolean(setContext) && queue.length > 0,
  };
}
