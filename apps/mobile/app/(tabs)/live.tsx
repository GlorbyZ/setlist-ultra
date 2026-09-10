import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { LiveChrome } from '@/src/components/LiveChrome';
import { LiveSongPage } from '@/src/components/LiveSongPage';
import { SetlistQuickAccess } from '@/src/components/SetlistQuickAccess';
import { SongViewer, type SongViewerHandle } from '@/src/components/SongViewer';
import { SwipePager, type SwipePagerPage } from '@/src/components/SwipePager';
import { useLiveChartSession } from '@/src/display/useLiveChartSession';
import { useLiveQueue } from '@/src/hooks/useLiveQueue';
import { resolveAutoscrollSeconds } from '@/src/lib/autoscroll';
import {
  currentSoundingKey,
  keyShiftToPick,
  persistLiveKeyCapo,
  songMetaLine,
  wrapCapo,
} from '@/src/lib/liveKeyCapo';
import { useKeepAwake } from 'expo-keep-awake';
import { getCachedSongDocument, warmSongDocuments } from '@/src/lib/songChartCache';
import { liveScrollFor, rememberLiveScroll } from '@/src/lib/liveSession';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import { chartJumpTargets } from '@setlist-ultra/core';

export default function LiveTab() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  useKeepAwake();
  const { queue, index, song, loading, go, goTo, setContext, hasSetContext } = useLiveQueue();
  const { fontSize, setFontSize, hideChords, setHideChords } = useLiveChartSession();
  const [keyShift, setKeyShift] = useState(0);
  const [capo, setCapo] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [setlistOpen, setSetlistOpen] = useState(false);
  const viewerRef = useRef<SongViewerHandle>(null);

  const prevSong = index > 0 ? queue[index - 1] : null;
  const nextSong = index < queue.length - 1 ? queue[index + 1] : null;

  useEffect(() => {
    warmSongDocuments([prevSong, song, nextSong]);
  }, [prevSong?.id, song?.id, nextSong?.id, prevSong?.updatedAt, song?.updatedAt, nextSong?.updatedAt]);

  // Sync Key/Capo from storage only when the active song changes.
  // Do NOT depend on song.capo/keyShift — persist writes those and would feedback-loop with refresh/reload.
  useEffect(() => {
    if (!song) return;
    setCapo(song.capo ?? 0);
    setKeyShift(song.keyShift ?? 0);
    setScrolling(false);
    if (song.midiOnLoad) void sendMidiOnLoad(song.midiOnLoad);
  }, [song?.id]);

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next') go(1);
      if (action === 'prev') go(-1);
      if (action === 'scrollDown') setScrolling(true);
      if (action === 'scrollUp') viewerRef.current?.scrollBy(-180);
    });
  }, [go]);

  // Persist fire-and-forget. Local state is source of truth until song.id changes;
  // useLiveQueue reload on focus picks up DB values. Avoid refresh+reload here (update-depth loop).
  const changeKeyShift = useCallback(
    (next: number) => {
      setKeyShift(next);
      if (!song) return;
      void persistLiveKeyCapo(song.id, { keyShift: next });
    },
    [song],
  );

  const changeCapo = useCallback(
    (next: number) => {
      setCapo(next);
      if (!song) return;
      void persistLiveKeyCapo(song.id, { capo: next });
    },
    [song],
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
        <Text style={styles.body}>Pick a song or set.</Text>
        <BrandButton label="Go to Songs" onPress={() => router.push('/')} />
        <BrandButton label="Go to Sets" onPress={() => router.push('/sets')} />
      </View>
    );
  }

  const duration = resolveAutoscrollSeconds(song.duration2, song.durationSeconds);
  const reserveTopLeft = hasSetContext;
  const sounding = currentSoundingKey(song.originalKey, keyShift);
  const canJumpSection = chartJumpTargets(chart).length > 0;
  const pages: SwipePagerPage[] = [];
  if (prevChart && prevSong) {
    pages.push({
      key: prevSong.id,
      queueIndex: index - 1,
      content: (
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
      ),
    });
  }
  pages.push({
    key: song.id,
    queueIndex: index,
    content: (
      <LiveSongPage
        title={song.title}
        meta={songMetaLine(song, keyShift)}
        capo={capo}
        onCapo={(d) => changeCapo(wrapCapo(capo, d))}
        reserveTopLeft={reserveTopLeft}>
          <SongViewer
            ref={viewerRef}
            document={chart}
            transpose={keyShift}
            capo={capo}
            hideChords={hideChords}
            autoScrollSeconds={scrolling ? duration : undefined}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            initialScrollY={liveScrollFor(song.id)}
            onScrollOffset={(y) => rememberLiveScroll(song.id, y)}
          />
      </LiveSongPage>
    ),
  });
  if (nextChart && nextSong) {
    pages.push({
      key: nextSong.id,
      queueIndex: index + 1,
      content: (
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
      ),
    });
  }

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
        onOpenSetlist={hasSetContext ? () => setSetlistOpen(true) : undefined}
        onNextSection={canJumpSection ? () => viewerRef.current?.scrollToNextSection() : undefined}
        onPedal={(action) => {
          if (action === 'next') go(1);
          if (action === 'prev') go(-1);
          if (action === 'scrollDown') setScrolling(true);
          if (action === 'scrollUp') viewerRef.current?.scrollBy(-180);
        }}>
        <SwipePager
          index={index}
          onPrev={prevSong ? () => go(-1) : undefined}
          onNext={nextSong ? () => go(1) : undefined}
          pages={pages}
        />
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
    body: {
      color: t.muted,
      textAlign: 'center' as const,
      marginBottom: 16,
      fontSize: t.type.body.fontSize,
      lineHeight: t.type.body.lineHeight,
      fontWeight: t.type.body.fontWeight,
    },
  };
}

