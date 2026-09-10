import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { transposeKeyName } from '@setlist-ultra/core';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { LiveChrome } from '@/src/components/LiveChrome';
import { SongViewer } from '@/src/components/SongViewer';
import { SwipePager } from '@/src/components/SwipePager';
import { useLiveQueue } from '@/src/hooks/useLiveQueue';
import { formatClock } from '@/src/lib/format';
import { resolveAutoscrollSeconds } from '@/src/lib/autoscroll';
import { getCachedSongDocument, warmSongDocuments } from '@/src/lib/songChartCache';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

function wrapCapo(value: number, delta: number) {
  const next = value + delta;
  if (next < 0) return 12;
  if (next > 12) return 0;
  return next;
}

export default function LiveTab() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { queue, index, song, loading, go } = useLiveQueue();
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0);
  const [hideChords, setHideChords] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  const prevSong = index > 0 ? queue[index - 1] : null;
  const nextSong = index < queue.length - 1 ? queue[index + 1] : null;

  useEffect(() => {
    warmSongDocuments([prevSong, song, nextSong]);
  }, [prevSong?.id, song?.id, nextSong?.id, prevSong?.updatedAt, song?.updatedAt, nextSong?.updatedAt]);

  useEffect(() => {
    if (!song) return;
    setCapo(song.capo ?? 0);
    setTranspose(song.keyShift ?? 0);
    setScrolling(false);
    if (song.midiOnLoad) void sendMidiOnLoad(song.midiOnLoad);
  }, [song?.id]);

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next') go(1);
      if (action === 'prev') go(-1);
      if (action === 'scrollDown') setScrolling(true);
    });
  }, [go]);

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
  const soundingKey = transposeKeyName(song.originalKey, transpose) ?? song.originalKey;
  const meta = [song.artist, soundingKey, formatClock(duration)].filter(Boolean).join(' · ');

  return (
    <LiveChrome
      title={song.title}
      meta={meta}
      capo={capo}
      tempo={song.tempo}
      onCapo={(d) => setCapo((v) => wrapCapo(v, d))}
      onEdit={() => router.push(`/editor/${song.id}` as Href)}
      onPrev={prevSong ? () => go(-1) : undefined}
      onNext={nextSong ? () => go(1) : undefined}
      onTranspose={(d) => setTranspose((v) => v + d)}
      onToggleLyrics={() => setHideChords((v) => !v)}
      lyricsOnly={hideChords}
      onToggleScroll={() => setScrolling((v) => !v)}
      scrolling={scrolling}
      onZoom={(d) => setFontSize((v) => Math.min(32, Math.max(14, v + d * 2)))}
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
            <SongViewer
              document={prevChart}
              transpose={prevSong.keyShift ?? 0}
              capo={prevSong.capo ?? 0}
              hideChords={hideChords}
              fontSize={fontSize}
            />
          ) : null
        }
        nextPage={
          nextChart && nextSong ? (
            <SongViewer
              document={nextChart}
              transpose={nextSong.keyShift ?? 0}
              capo={nextSong.capo ?? 0}
              hideChords={hideChords}
              fontSize={fontSize}
            />
          ) : null
        }>
        <SongViewer
          document={chart}
          transpose={transpose}
          capo={capo}
          hideChords={hideChords}
          autoScrollSeconds={scrolling ? duration : undefined}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
        />
      </SwipePager>
    </LiveChrome>
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
    body: { color: t.muted, textAlign: 'center' as const, marginBottom: 16, fontSize: t.type.body.fontSize, lineHeight: t.type.body.lineHeight, fontWeight: t.type.body.fontWeight },
  };
}