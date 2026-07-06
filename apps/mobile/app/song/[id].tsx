import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { SongViewer } from '@/src/components/SongViewer';
import { getSong, parseSongDocument } from '@/src/lib/repository';
import type { SongRow } from '@setlist-ultra/db';

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [song, setSong] = useState<SongRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0);
  const [hideChords, setHideChords] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      setLoading(true);
      const row = await getSong(id);
      setSong(row);
      setCapo(row?.capo ?? 0);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!song) {
    return (
      <View style={styles.center}>
        <Text>Song not found.</Text>
      </View>
    );
  }

  const document = parseSongDocument(song);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.meta}>
          {song.artist}
          {song.originalKey ? ` · Key ${song.originalKey}` : ''}
          {transpose !== 0 ? ` · ${transpose > 0 ? '+' : ''}${transpose}` : ''}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.chip} onPress={() => setTranspose((v) => v - 1)}>
          <Text style={styles.chipText}>-1</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setTranspose(0)}>
          <Text style={styles.chipText}>0</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setTranspose((v) => v + 1)}>
          <Text style={styles.chipText}>+1</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setCapo((v) => Math.max(0, v - 1))}>
          <Text style={styles.chipText}>Capo -</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setCapo((v) => v + 1)}>
          <Text style={styles.chipText}>Capo +</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setHideChords((v) => !v)}>
          <Text style={styles.chipText}>{hideChords ? 'Chords' : 'Lyrics'}</Text>
        </Pressable>
      </View>

      <SongViewer
        document={document}
        transpose={transpose}
        capo={capo}
        hideChords={hideChords}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
  meta: { color: '#94a3b8', marginTop: 4 },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: '#f8fafc', fontWeight: '600' },
});
