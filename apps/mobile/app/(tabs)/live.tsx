import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { LiveChrome } from '@/src/components/LiveChrome';
import { LiveSongPage } from '@/src/components/LiveSongPage';
import { SetlistQuickAccess } from '@/src/components/SetlistQuickAccess';
import { SongViewer, type SongViewerHandle } from '@/src/components/SongViewer';
import { SwipePager, type SwipePagerPage } from '@/src/components/SwipePager';
import { useLiveChartSession } from '@/src/display/useLiveChartSession';
import { useLiveQueue, type LiveQueueItem } from '@/src/hooks/useLiveQueue';
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
import { launchFlags } from '@/src/lib/launchFlags';
import { openLocalMedia } from '@/src/lib/mediaStore';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import { chartJumpTargets } from '@setlist-ultra/core';

function stopPlayer(player: { pause: () => void; seekTo: (n: number) => Promise<void> }) {
  try {
    player.pause();
    void player.seekTo(0);
  } catch {
    /* player may already be released */
  }
}

export default function LiveTab() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  useKeepAwake();
  const { queue, index, entry, song, loading, go, goTo, setContext, hasSetContext, followBand, setFollowBand } =
    useLiveQueue();
  const { fontSize, setFontSize, hideChords, setHideChords } = useLiveChartSession();
  const [keyShift, setKeyShift] = useState(0);
  const [capo, setCapo] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [setlistOpen, setSetlistOpen] = useState(false);
  const viewerRef = useRef<SongViewerHandle>(null);
  const audioSource = launchFlags.audio && song?.linkedAudio ? { uri: song.linkedAudio } : undefined;
  const audioPlayer = useAudioPlayer(audioSource);
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  const prev = index > 0 ? queue[index - 1] : null;
  const next = index < queue.length - 1 ? queue[index + 1] : null;
  const prevSong = prev?.kind === 'song' ? prev.song ?? null : null;
  const nextSong = next?.kind === 'song' ? next.song ?? null : null;

  useEffect(() => {
    warmSongDocuments([prevSong, song, nextSong]);
  }, [prevSong?.id, song?.id, nextSong?.id, prevSong?.updatedAt, song?.updatedAt, nextSong?.updatedAt]);

  useEffect(() => {
    setScrolling(false);
    stopPlayer(audioPlayer);
    if (song) {
      setCapo(song.capo ?? 0);
      setKeyShift(song.keyShift ?? 0);
      if (song.midiOnLoad) void sendMidiOnLoad(song.midiOnLoad);
    }
  }, [entry?.key]);

  useEffect(() => {
    if (!audioStatus.didJustFinish) return;
    stopPlayer(audioPlayer);
  }, [audioStatus.didJustFinish, audioPlayer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        try {
          audioPlayer.pause();
        } catch {
          /* ignore */
        }
      }
    });
    return () => sub.remove();
  }, [audioPlayer]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          audioPlayer.pause();
        } catch {
          /* ignore */
        }
      };
    }, [audioPlayer]),
  );

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next') go(1);
      if (action === 'prev') go(-1);
      if (action === 'scrollDown') setScrolling(true);
      if (action === 'scrollUp') viewerRef.current?.scrollBy(-180);
    });
  }, [go]);

  const changeKeyShift = useCallback(
    (nextShift: number) => {
      setKeyShift(nextShift);
      if (!song) return;
      void persistLiveKeyCapo(song.id, { keyShift: nextShift });
    },
    [song],
  );

  const changeCapo = useCallback(
    (nextCapo: number) => {
      setCapo(nextCapo);
      if (!song) return;
      void persistLiveKeyCapo(song.id, { capo: nextCapo });
    },
    [song],
  );

  const chart = useMemo(
    () => (song ? getCachedSongDocument(song) : null),
    [song?.id, song?.contentAst, song?.chordpro, song?.updatedAt],
  );
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

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>Pick a song or set.</Text>
        <BrandButton label="Go to Songs" onPress={() => router.push('/')} />
        <BrandButton label="Go to Sets" onPress={() => router.push('/sets')} />
      </View>
    );
  }

  const duration = song ? resolveAutoscrollSeconds(song.duration2, song.durationSeconds) : undefined;
  const reserveTopLeft = hasSetContext;
  const sounding = song ? currentSoundingKey(song.originalKey, keyShift) : '';
  const canJumpSection = chart ? chartJumpTargets(chart).length > 0 : false;

  const pageFor = (item: LiveQueueItem, queueIndex: number, role: 'prev' | 'current' | 'next'): SwipePagerPage => {
    if (item.kind !== 'song' || !item.song) {
      return {
        key: item.key,
        queueIndex,
        content: (
          <LiveSongPage title={item.title} meta={item.kind === 'timer' ? 'Break' : 'Note'} reserveTopLeft={reserveTopLeft}>
            <LiveBreakBody
              kind={item.kind}
              body={item.noteContent ?? ''}
              seconds={item.timerSeconds ?? 0}
              active={role === 'current'}
            />
          </LiveSongPage>
        ),
      };
    }
    const doc =
      role === 'current' ? chart : role === 'prev' ? prevChart : nextChart;
    const row = item.song;
    const isCurrent = role === 'current';
    return {
      key: item.key,
      queueIndex,
      content: (
        <LiveSongPage
          title={row.title}
          meta={songMetaLine(row, isCurrent ? keyShift : row.keyShift ?? 0)}
          capo={isCurrent ? capo : row.capo ?? 0}
          onCapo={isCurrent ? (d) => changeCapo(wrapCapo(capo, d)) : undefined}
          reserveTopLeft={reserveTopLeft}>
          {doc ? (
            <SongViewer
              ref={isCurrent ? viewerRef : undefined}
              document={doc}
              transpose={isCurrent ? keyShift : row.keyShift ?? 0}
              capo={isCurrent ? capo : row.capo ?? 0}
              hideChords={hideChords}
              autoScrollSeconds={isCurrent && scrolling ? duration : undefined}
              fontSize={fontSize}
              onFontSizeChange={isCurrent ? setFontSize : undefined}
              initialScrollY={liveScrollFor(item.key)}
              onScrollOffset={isCurrent ? (y) => rememberLiveScroll(item.key, y) : undefined}
            />
          ) : null}
        </LiveSongPage>
      ),
    };
  };

  const pages: SwipePagerPage[] = [];
  if (prev) pages.push(pageFor(prev, index - 1, 'prev'));
  pages.push(pageFor(entry, index, 'current'));
  if (next) pages.push(pageFor(next, index + 1, 'next'));

  return (
    <View style={{ flex: 1 }}>
      {hasSetContext ? (
        <View style={styles.followBar}>
          <Text style={styles.followText}>
            {followBand
              ? 'Following set order (this chart stays until you swipe)'
              : setContext?.orgId
                ? 'Band set'
                : 'Set'}
          </Text>
          <Pressable onPress={() => void setFollowBand(!followBand)}>
            <Text style={styles.followAction}>{followBand ? 'Stop follow' : 'Follow set'}</Text>
          </Pressable>
        </View>
      ) : null}
      {song?.contentKind === 'pdf' && song.mediaUri ? (
        <Pressable
          style={styles.mediaBar}
          onPress={() => void openLocalMedia(song.mediaUri!, 'application/pdf', song.title)}>
          <Text style={styles.mediaBarText}>Open PDF in another app (no in-app markup)</Text>
        </Pressable>
      ) : null}
      {launchFlags.audio && song?.linkedAudio ? (
        <Pressable
          style={styles.mediaBar}
          onPress={() => {
            if (audioStatus.playing) audioPlayer.pause();
            else audioPlayer.play();
          }}>
          <Text style={styles.mediaBarText}>
            {audioStatus.error
              ? 'Backing track failed'
              : audioStatus.playing
                ? 'Pause backing track'
                : 'Play backing track'}
          </Text>
        </Pressable>
      ) : null}
      <LiveChrome
        chromeKey={entry.key}
        tempo={song?.tempo}
        capo={song ? capo : 0}
        soundingKey={sounding}
        onCapo={song ? (d) => changeCapo(wrapCapo(capo, d)) : undefined}
        onCapoPick={song ? (n) => changeCapo(n) : undefined}
        onEdit={song ? () => router.push(('/editor/' + song.id) as Href) : undefined}
        onPrev={prev ? () => go(-1) : undefined}
        onNext={next ? () => go(1) : undefined}
        onTranspose={song ? (d) => changeKeyShift(keyShift + d) : undefined}
        onKeyPick={song ? (keyName) => changeKeyShift(keyShiftToPick(song.originalKey, keyName, keyShift)) : undefined}
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
          currentKey={entry.key}
          onSelect={(_key, songIndex) => goTo(songIndex)}
        />
      ) : null}
    </View>
  );
}

function LiveBreakBody({
  kind,
  body,
  seconds,
  active,
}: {
  kind: 'note' | 'timer' | 'song';
  body: string;
  seconds: number;
  active: boolean;
}) {
  const { theme } = useTheme();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (kind !== 'timer' || !active) {
      setLeft(seconds);
      return;
    }
    setLeft(seconds);
    const timer = setInterval(() => {
      setLeft((n) => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [kind, seconds, active]);

  if (kind === 'timer') {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 48, fontWeight: '800' }}>{left}s</Text>
        <Text style={{ color: theme.muted, marginTop: 8 }}>Break · swipe when you are ready</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700', lineHeight: 30 }}>{body || 'Note'}</Text>
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
    followBar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.panel,
    },
    followText: { color: t.muted, fontSize: 12, flex: 1, paddingRight: 8 },
    followAction: { color: t.accent, fontWeight: '700' as const, fontSize: 13 },
    mediaBar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.panel,
    },
    mediaBarText: { color: t.accent, fontWeight: '700' as const, fontSize: 13 },
  };
}
