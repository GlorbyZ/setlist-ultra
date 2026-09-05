import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { LiveChrome } from '@/src/components/LiveChrome';
import { SongViewer } from '@/src/components/SongViewer';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { getAppState, getSong, parseSongDocument } from '@/src/lib/repository';
import { subscribePedals } from '@/src/lib/pedals';
import { sendMidiOnLoad } from '@/src/lib/midi';
import { colors } from '@/src/theme';
import type { SongRow } from '@setlist-ultra/db';

export default function LiveTab() {
  const { songs, setlists } = useLibrary();
  const router = useRouter();
  const [song, setSong] = useState<SongRow | null>(null);
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0);
  const [hideChords, setHideChords] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const state = await getAppState();
      const id = state.currentSongId ?? songs[0]?.id;
      const row = id ? await getSong(id) : null;
      setSong(row);
      setCapo(row?.capo ?? 0);
      setTranspose(row?.keyShift ?? 0);
      setLoading(false);
      if (row?.midiOnLoad) void sendMidiOnLoad(row.midiOnLoad);
    })();
  }, [songs]);

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next' && song) {
        const idx = songs.findIndex((s) => s.id === song.id);
        const next = songs[idx + 1];
        if (next) router.push(`/song/${next.id}`);
      }
      if (action === 'prev' && song) {
        const idx = songs.findIndex((s) => s.id === song.id);
        const prev = songs[idx - 1];
        if (prev) router.push(`/song/${prev.id}`);
      }
      if (action === 'scrollDown') setScrolling(true);
    });
  }, [song, songs, router]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;

  if (!song) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>Open a song or set to start the live viewer.</Text>
        <Pressable style={styles.button} onPress={() => router.push('/')}>
          <Text style={styles.buttonText}>Go to Songs</Text>
        </Pressable>
      </View>
    );
  }

  const duration = song.duration2 ?? song.durationSeconds ?? 90;

  return (
    <View style={styles.container}>
      <LiveChrome
        title={song.title}
        subtitle={`${song.artist}${song.originalKey ? ` · ${song.originalKey}` : ''}`}
        extra={setlists[0] ? `Last set: ${setlists[0].title}` : undefined}
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
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { color: colors.muted, textAlign: 'center', marginBottom: 16 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  buttonText: { color: colors.accentText, fontWeight: '700' },
});
