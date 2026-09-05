import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LiveChrome } from '@/src/components/LiveChrome';
import { SongViewer } from '@/src/components/SongViewer';
import { getSong, parseSongDocument, patchAppState } from '@/src/lib/repository';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { colors } from '@/src/theme';
import type { SongRow } from '@setlist-ultra/db';
import { Text } from '@/components/Themed';

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [song, setSong] = useState<SongRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0);
  const [hideChords, setHideChords] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      setLoading(true);
      const row = await getSong(id);
      setSong(row);
      setCapo(row?.capo ?? 0);
      setTranspose(row?.keyShift ?? 0);
      setLoading(false);
      if (row) {
        await patchAppState({ currentSongId: row.id });
        if (row.midiOnLoad) void sendMidiOnLoad(row.midiOnLoad);
      }
    })();
  }, [id]);

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'scrollDown') setScrolling(true);
      if (action === 'scrollUp') setScrolling(false);
    });
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  }

  if (!song) {
    return (
      <View style={styles.center}>
        <Text>Song not found.</Text>
      </View>
    );
  }

  const duration = song.duration2 ?? song.durationSeconds ?? 90;

  return (
    <View style={styles.container}>
      <LiveChrome
        title={song.title}
        subtitle={`${song.artist}${song.originalKey ? ` · Key ${song.originalKey}` : ''}${
          transpose !== 0 ? ` · ${transpose > 0 ? '+' : ''}${transpose}` : ''
        }`}
        extra={song.notesText || undefined}
        onTranspose={(d) => setTranspose((v) => v + d)}
        onCapo={(d) => setCapo((v) => Math.max(0, v + d))}
        onToggleLyrics={() => setHideChords((v) => !v)}
        lyricsOnly={hideChords}
        onToggleScroll={() => setScrolling((v) => !v)}
        scrolling={scrolling}
        onEdit={() => router.push(`/editor/${song.id}` as Href)}
        onPedal={(action) => {
          if (action === 'scrollDown') setScrolling(true);
        }}
      />
      <SongViewer
        document={parseSongDocument(song)}
        transpose={transpose}
        capo={capo}
        hideChords={hideChords}
        autoScrollSeconds={scrolling ? duration : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
