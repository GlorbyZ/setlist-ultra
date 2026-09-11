import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/Themed';
import { LiveChrome } from '@/src/components/LiveChrome';
import { ActionSheet } from '@/src/components/BrandDialog';
import { LiveSongPage } from '@/src/components/LiveSongPage';
import { SetlistQuickAccess } from '@/src/components/SetlistQuickAccess';
import { SongViewer, type SongViewerHandle } from '@/src/components/SongViewer';
import { SwipePager, type SwipePagerPage } from '@/src/components/SwipePager';
import { useLiveChartSession } from '@/src/display/useLiveChartSession';
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
import { launchFlags } from '@/src/lib/launchFlags';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import { chartJumpTargets } from '@setlist-ultra/core';

export default function SongScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { queue, index, entry, song, loading, go, goTo, setContext, hasSetContext } = useLiveQueue(id);
  const { fontSize, setFontSize, hideChords, setHideChords } = useLiveChartSession();
  const [keyShift, setKeyShift] = useState(0);
  const [capo, setCapo] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [setlistOpen, setSetlistOpen] = useState(false);
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const viewerRef = useRef<SongViewerHandle>(null);

  const prev = index > 0 ? queue[index - 1] : null;
  const next = index < queue.length - 1 ? queue[index + 1] : null;
  const prevSong = prev?.kind === 'song' ? prev.song ?? null : null;
  const nextSong = next?.kind === 'song' ? next.song ?? null : null;

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
  }, [song?.id]);

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next') go(1);
      if (action === 'prev') go(-1);
      if (action === 'scrollDown') setScrolling(true);
      if (action === 'scrollUp') setScrolling(false);
    });
  }, [go]);

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
        <Text>Song not found.</Text>
      </View>
    );
  }

  const duration = song.duration2 ?? song.durationSeconds ?? 90;
  const reserveTopLeft = hasSetContext;
  const sounding = currentSoundingKey(song.originalKey, keyShift);
  const canJumpSection = chartJumpTargets(chart).length > 0;
  const pages: SwipePagerPage[] = [];
  if (prevChart && prevSong) {
    pages.push({
      key: prev?.key ?? prevSong.id,
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
    key: entry?.key ?? song.id,
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
        />
      </LiveSongPage>
    ),
  });
  if (nextChart && nextSong) {
    pages.push({
      key: next?.key ?? nextSong.id,
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
        chromeKey={entry?.key ?? song.id}
        tempo={song.tempo}
        capo={capo}
        soundingKey={sounding}
        onCapo={(d) => changeCapo(wrapCapo(capo, d))}
        onCapoPick={(n) => changeCapo(n)}
        onEdit={() => router.push(('/editor/' + song.id) as Href)}
        onSongMenu={() => setSongMenuOpen(true)}
        onPrev={prev ? () => go(-1) : undefined}
        onNext={next ? () => go(1) : undefined}
        onTranspose={(d) => changeKeyShift(keyShift + d)}
        onKeyPick={(keyName) => changeKeyShift(keyShiftToPick(song.originalKey, keyName, keyShift))}
        onToggleLyrics={() => setHideChords((v) => !v)}
        lyricsOnly={hideChords}
        onToggleScroll={() => setScrolling((v) => !v)}
        scrolling={scrolling}
        onZoom={(d) => setFontSize((v) => Math.min(32, Math.max(14, v + d * 2)))}
        padDock
        onOpenSetlist={hasSetContext ? () => setSetlistOpen(true) : undefined}
        onNextSection={canJumpSection ? () => viewerRef.current?.scrollToNextSection() : undefined}
        onPedal={(action) => {
          if (action === 'next') go(1);
          if (action === 'prev') go(-1);
          if (action === 'scrollDown') setScrolling(true);
        }}>
        <SwipePager
          index={index}
          onPrev={prev ? () => go(-1) : undefined}
          onNext={next ? () => go(1) : undefined}
          pages={pages}
        />
      </LiveChrome>

      {setContext && hasSetContext ? (
        <SetlistQuickAccess
          open={setlistOpen}
          onClose={() => setSetlistOpen(false)}
          setTitle={setContext.title}
          eventDate={setContext.eventDate}
          entries={queue}
          currentKey={entry?.key ?? song.id}
          onSelect={(_key, songIndex) => goTo(songIndex)}
        />
      ) : null}

      <ActionSheet
        visible={songMenuOpen}
        title={song.title}
        onClose={() => setSongMenuOpen(false)}
        options={[
          { label: 'Song Settings', onPress: () => router.push(('/editor/' + song.id) as Href) },
          ...(launchFlags.ai
            ? [
                {
                  label: 'Clean Up Chart',
                  onPress: () =>
                    router.push(`/ai?task=fix-chart&songId=${encodeURIComponent(song.id)}` as Href),
                },
              ]
            : []),
        ]}
      />
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

