import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/Themed';
import { LiveChrome } from '@/src/components/LiveChrome';
import { LiveSongPage } from '@/src/components/LiveSongPage';
import { SetlistQuickAccess } from '@/src/components/SetlistQuickAccess';
import { SongViewer } from '@/src/components/SongViewer';
import { SwipePager } from '@/src/components/SwipePager';
import { useLiveQueue } from '@/src/hooks/useLiveQueue';
import {
  currentSoundingKey,
  keyShiftToPick,
  persistLiveKeyCapo,
  songMetaLine,
  wrapCapo,
} from '@/src/lib/liveKeyCapo';
import { getCachedSongDocument, warmSongDocuments } from '@/src/lib/songChartCache';
import { patchAppState } from '@/src/lib/repository';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function SongScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useLibrary();
  const { queue, index, song, loading, go, goTo, reload, setContext, hasSetContext } = useLiveQueue(id);
  const [keyShift, setKeyShift] = useState(0);
  const [capo, setCapo] = useState(0);
  const [hideChords, setHideChords] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [setlistOpen, setSetlistOpen] = useState(false);

  const prevSong = index > 0 ? queue[index - 1] : null;
  const nextSong = index < queue.length - 1 ? queue[index + 1] : null;

  useEffect(() => {
    warmSongDocuments([prevSong, song, nextSong]);
  }, [prevSong?.id, song?.id, nextSong?.id, prevSong?.updatedAt, song?.updatedAt, nextSong?.updatedAt]);

  useEffect(() => {
    if (!song) return;
    setCapo(song.capo ?? 0);
    setKeyShift(song.keyShift ?? 0);
    setScrolling(false);
    void patchAppState({ currentSongId: song.id });
    if (song.midiOnLoad) void sendMidiOnLoad(song.midiOnLoad);
  }, [song?.id, song?.capo, song?.keyShift]);

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next') go(1);
      if (action === 'prev') go(-1);
      if (action === 'scrollDown') setScrolling(true);
      if (action === 'scrollUp') setScrolling(false);
    });
  }, [go]);

  const persistAndRefresh = useCallback(
    async (patch: { keyShift?: number; capo?: number }) => {
      if (!song) return;
      await persistLiveKeyCapo(song.id, patch);
      await refresh({ silent: true });
      await reload();
    },
    [song, refresh, reload],
  );

  const changeKeyShift = useCallback(
    (next: number) => {
      setKeyShift(next);
      void persistAndRefresh({ keyShift: next });
    },
    [persistAndRefresh],
  );

  const changeCapo = useCallback(
    (next: number) => {
      setCapo(next);
      void persistAndRefresh({ capo: next });
    },
    [persistAndRefresh],
  );

  const chart = useMemo(() => (song ? getCachedSongDocument(song) : null), [song?.id, song?.contentAst, song?.chordpro, song?.updatedAt]);
  const prevChart = useMemo(
    () => (prevSong ? getCachedSongDocument(prevSong) : null),
    [prevSong?.id, prevSong?.contentAst, prevSong?.chordpro, prevSong?.updatedAt],
  );
  const nextChart = useMemo(
    () => (nextSong ? getCachedSongDocument(nextSong) : null),
    [nextSong?.id, nextSong?.contentAst, nextSong?.chordpro, nextSong?.updatedAt],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!song || !chart) {
    return (
      <View style={styles.center}>
        <Text>Song not found.</Text>
      </View>
    );
  }

  const duration = song.duration2 ?? song.durationSeconds ?? 90;
  const reserveTopLeft = hasSetContext;
  const sounding = currentSoundingKey(song.originalKey, keyShift);

  return (
    <View style={{ flex: 1 }}>
      <LiveChrome
        chromeKey={song.id}
        tempo={song.tempo}
        capo={capo}
        soundingKey={sounding}
        onCapo={(d) => changeCapo(wrapCapo(capo, d))}
        onCapoPick={(n) => changeCapo(n)}
        onEdit={() => router.push(('/editor/' + song.id) as Href)}
        onPrev={prevSong ? () => go(-1) : undefined}
        onNext={nextSong ? () => go(1) : undefined}
        onTranspose={(d) => changeKeyShift(keyShift + d)}
        onKeyPick={(keyName) => changeKeyShift(keyShiftToPick(song.originalKey, keyName, keyShift))}
        onToggleLyrics={() => setHideChords((v) => !v)}
        lyricsOnly={hideChords}
        onToggleScroll={() => setScrolling((v) => !v)}
        scrolling={scrolling}
        onZoom={(d) => setFontSize((v) => Math.min(32, Math.max(14, v + d * 2)))}
        padDock
        onOpenSetlist={hasSetContext ? () => setSetlistOpen(true) : undefined}
        onPedal={(action) => {
          if (action === 'next') go(1);
          if (action === 'prev') go(-1);
          if (action === 'scrollDown') setScrolling(true);
        }}>
        <SwipePager
          pageKey={song.id}
          onPrev={prevSong ? () => go(-1) : undefined}
          onNext={nextSong ? () => go(1) : undefined}
          prevPage={
            prevChart && prevSong ? (
              <LiveSongPage
                title={prevSong.title}
                meta={songMetaLine(prevSong, prevSong.keyShift ?? 0)}
                capo={prevSong.capo ?? 0}
                reserveTopLeft={reserveTopLeft}>
                <SongViewer
                  document={prevChart}
                  transpose={prevSong.keyShift ?? 0}
                  capo={prevSong.capo ?? 0}
                  hideChords={hideChords}
                  fontSize={fontSize}
                />
              </LiveSongPage>
            ) : null
          }
          nextPage={
            nextChart && nextSong ? (
              <LiveSongPage
                title={nextSong.title}
                meta={songMetaLine(nextSong, nextSong.keyShift ?? 0)}
                capo={nextSong.capo ?? 0}
                reserveTopLeft={reserveTopLeft}>
                <SongViewer
                  document={nextChart}
                  transpose={nextSong.keyShift ?? 0}
                  capo={nextSong.capo ?? 0}
                  hideChords={hideChords}
                  fontSize={fontSize}
                />
              </LiveSongPage>
            ) : null
          }>
          <LiveSongPage
            title={song.title}
            meta={songMetaLine(song, keyShift)}
            capo={capo}
            onCapo={(d) => changeCapo(wrapCapo(capo, d))}
            reserveTopLeft={reserveTopLeft}>
            <SongViewer
              document={chart}
              transpose={keyShift}
              capo={capo}
              hideChords={hideChords}
              autoScrollSeconds={scrolling ? duration : undefined}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
            />
          </LiveSongPage>
        </SwipePager>
      </LiveChrome>

      {setContext && hasSetContext ? (
        <SetlistQuickAccess
          open={setlistOpen}
          onClose={() => setSetlistOpen(false)}
          setTitle={setContext.title}
          eventDate={setContext.eventDate}
          songs={queue}
          currentSongId={song.id}
          onSelectSong={(_id, songIndex) => goTo(songIndex)}
        />
      ) : null}
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    center: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 24,
    },
  };
}

