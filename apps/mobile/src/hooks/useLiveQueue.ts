import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { isNativeDbDead, recoverDatabase } from '@/src/lib/db';
import { mergeFollowQueue } from '@/src/lib/liveSession';
import {
  getAppState,
  getSetlist,
  getSetlistItems,
  getSong,
  getSongsByIds,
  listSongs,
  patchAppState,
} from '@/src/lib/repository';
import type { SongRow } from '@setlist-ultra/db';

const FOLLOW_KEY = 'setlist-ultra.live.followBand';

export type LiveSetContext = {
  id: string;
  title: string;
  eventDate: string | null;
  libraryKind: string;
  orgId: string | null;
};

async function readFollowPref() {
  try {
    return (await SecureStore.getItemAsync(FOLLOW_KEY)) === '1';
  } catch {
    return false;
  }
}

export function useLiveQueue(preferredSongId?: string) {
  const [queue, setQueue] = useState<SongRow[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setContext, setSetContext] = useState<LiveSetContext | null>(null);
  const [followBand, setFollowBandState] = useState(false);
  const songRef = useRef<SongRow | null>(null);

  const reload = useCallback(async () => {
    const load = async () => {
      const state = await getAppState();
      const librarySongs = await listSongs();
      let list: SongRow[] = librarySongs;
      let nextIndex = 0;
      let nextSet: LiveSetContext | null = null;

      if (state.currentSetlistId) {
        const setRow = await getSetlist(state.currentSetlistId);
        if (setRow) {
          nextSet = {
            id: setRow.id,
            title: setRow.title,
            eventDate: setRow.eventDate ?? null,
            libraryKind: setRow.libraryKind,
            orgId: setRow.orgId ?? null,
          };
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
          const fromLibrary = librarySongs.find((song) => song.id === preferred);
          const row = fromLibrary ?? (await getSong(preferred));
          list = fromLibrary
            ? librarySongs
            : row
              ? [row, ...librarySongs.filter((song) => song.id !== row.id)]
              : librarySongs;
          nextIndex = Math.max(0, list.findIndex((song) => song.id === preferred));
        } else {
          list = librarySongs;
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
  }, [preferredSongId]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const refreshFollow = useCallback(async () => {
    const state = await getAppState();
    if (!state.currentSetlistId) return;
    const items = await getSetlistItems(state.currentSetlistId);
    const songIds = items
      .filter((item) => item.itemType === 'song' && item.songId)
      .map((item) => item.songId as string);
    const incoming = await getSongsByIds(songIds);
    const merged = mergeFollowQueue(songRef.current, incoming);
    setQueue(merged.queue);
    setIndex(merged.index);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void reloadRef.current();
      void readFollowPref().then(setFollowBandState);
    }, []),
  );

  const setFollowBand = useCallback(async (next: boolean) => {
    setFollowBandState(next);
    try {
      await SecureStore.setItemAsync(FOLLOW_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!followBand || !setContext) return;
    const timer = setInterval(() => {
      void refreshFollow();
    }, 8000);
    return () => clearInterval(timer);
  }, [followBand, setContext, refreshFollow]);

  const song = queue[index] ?? null;
  songRef.current = song;

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
    followBand,
    setFollowBand,
  };
}
