import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { isNativeDbDead, recoverDatabase } from '@/src/lib/db';
import {
  buildLiveQueueFromSet,
  mergeFollowQueue,
  pickLiveIndex,
  type LiveQueueEntry,
} from '@/src/lib/liveSession';
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

export type LiveQueueItem = LiveQueueEntry<SongRow>;

async function readFollowPref() {
  try {
    return (await SecureStore.getItemAsync(FOLLOW_KEY)) === '1';
  } catch {
    return false;
  }
}

function songsToQueue(list: SongRow[]): LiveQueueItem[] {
  return list.map((song) => ({
    key: song.id,
    kind: 'song' as const,
    title: song.title,
    artist: song.artist,
    song,
  }));
}

export function useLiveQueue(preferredSongId?: string) {
  const [queue, setQueue] = useState<LiveQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setContext, setSetContext] = useState<LiveSetContext | null>(null);
  const [followBand, setFollowBandState] = useState(false);
  const entryRef = useRef<LiveQueueItem | null>(null);
  const followRunning = useRef(false);
  const followPending = useRef(false);
  const followGen = useRef(0);

  const reload = useCallback(async () => {
    const load = async () => {
      const state = await getAppState();
      const librarySongs = await listSongs();
      let list: LiveQueueItem[] = songsToQueue(librarySongs);
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
        const fetched = await getSongsByIds(songIds);
        const byId = Object.fromEntries(fetched.map((row) => [row.id, row]));
        list = buildLiveQueueFromSet(items, byId);
        const preferred = preferredSongId ?? state.currentSongId;
        nextIndex = pickLiveIndex(list, preferred, state.currentSetIndex);
      } else {
        const preferred = preferredSongId ?? state.currentSongId;
        if (preferred) {
          const fromLibrary = librarySongs.find((song) => song.id === preferred);
          const row = fromLibrary ?? (await getSong(preferred));
          const ordered = fromLibrary
            ? librarySongs
            : row
              ? [row, ...librarySongs.filter((song) => song.id !== row.id)]
              : librarySongs;
          list = songsToQueue(ordered);
          nextIndex = Math.max(
            0,
            list.findIndex((entry) => entry.song?.id === preferred),
          );
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
          if (!entryRef.current) {
            setQueue([]);
            setIndex(0);
            setSetContext(null);
          }
        }
      } else if (!entryRef.current) {
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
    if (followRunning.current) {
      followPending.current = true;
      return;
    }
    followRunning.current = true;
    const gen = ++followGen.current;
    try {
      const state = await getAppState();
      if (!state.currentSetlistId) return;
      const items = await getSetlistItems(state.currentSetlistId);
      const songIds = items
        .filter((item) => item.itemType === 'song' && item.songId)
        .map((item) => item.songId as string);
      const fetched = await getSongsByIds(songIds);
      const byId = Object.fromEntries(fetched.map((row) => [row.id, row]));
      const incoming = buildLiveQueueFromSet(items, byId);
      if (gen !== followGen.current) return;
      const merged = mergeFollowQueue(entryRef.current, incoming);
      setQueue(merged.queue);
      setIndex(merged.index);
    } catch (error) {
      console.error('Follow set refresh failed:', error);
    } finally {
      followRunning.current = false;
      if (followPending.current) {
        followPending.current = false;
        void refreshFollow();
      }
    }
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
    return () => {
      clearInterval(timer);
      followGen.current += 1;
    };
  }, [followBand, setContext, refreshFollow]);

  const entry = queue[index] ?? null;
  entryRef.current = entry;
  const song = entry?.kind === 'song' ? (entry.song ?? null) : null;

  const go = useCallback(
    (dir: -1 | 1) => {
      const next = index + dir;
      const target = queue[next];
      if (!target) return;
      setIndex(next);
      void patchAppState({
        currentSongId: target.song?.id ?? null,
        currentSetIndex: next,
      });
    },
    [index, queue],
  );

  const goTo = useCallback(
    (nextIndex: number) => {
      const target = queue[nextIndex];
      if (!target) return;
      setIndex(nextIndex);
      void patchAppState({
        currentSongId: target.song?.id ?? null,
        currentSetIndex: nextIndex,
      });
    },
    [queue],
  );

  return {
    queue,
    index,
    entry,
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
