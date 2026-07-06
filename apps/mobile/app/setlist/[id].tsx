import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { SongViewer } from '@/src/components/SongViewer';
import {
  getSetlist,
  getSetlistItems,
  getSong,
  parseSongDocument,
} from '@/src/lib/repository';
import type { SetlistItemRow, SetlistRow, SongRow } from '@setlist-ultra/db';

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [setlist, setSetlist] = useState<SetlistRow | null>(null);
  const [items, setItems] = useState<SetlistItemRow[]>([]);
  const [songsById, setSongsById] = useState<Record<string, SongRow>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transpose, setTranspose] = useState(0);

  useEffect(() => {
    void load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [setlistRow, itemRows] = await Promise.all([getSetlist(id), getSetlistItems(id)]);
    setSetlist(setlistRow);
    setItems(itemRows);

    const songIds = itemRows.map((item) => item.songId).filter(Boolean) as string[];
    const songRows = await Promise.all(songIds.map((songId) => getSong(songId)));
    const map: Record<string, SongRow> = {};
    songRows.forEach((song) => {
      if (song) map[song.id] = song;
    });
    setSongsById(map);
    setLoading(false);
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!setlist) {
    return (
      <View style={styles.center}>
        <Text>Setlist not found.</Text>
      </View>
    );
  }

  const activeItem = items[activeIndex];
  const activeSong = activeItem?.songId ? songsById[activeItem.songId] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{setlist.title}</Text>
        <Text style={styles.meta}>
          Item {items.length ? activeIndex + 1 : 0} of {items.length}
        </Text>
      </View>

      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.strip}
        renderItem={({ item, index }) => (
          <Pressable
            style={[styles.stripItem, index === activeIndex && styles.stripItemActive]}
            onPress={() => {
              setActiveIndex(index);
              setTranspose(item.overrideTranspose ?? 0);
            }}>
            <Text style={styles.stripText}>
              {item.itemType === 'note' ? 'Note' : songsById[item.songId ?? '']?.title ?? 'Song'}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.controls}>
        <Pressable
          style={styles.chip}
          disabled={activeIndex <= 0}
          onPress={() => setActiveIndex((v) => Math.max(0, v - 1))}>
          <Text style={styles.chipText}>Prev</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          disabled={activeIndex >= items.length - 1}
          onPress={() => setActiveIndex((v) => Math.min(items.length - 1, v + 1))}>
          <Text style={styles.chipText}>Next</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setTranspose((v) => v - 1)}>
          <Text style={styles.chipText}>-1</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setTranspose((v) => v + 1)}>
          <Text style={styles.chipText}>+1</Text>
        </Pressable>
      </View>

      {activeItem?.itemType === 'note' ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{activeItem.noteContent}</Text>
        </View>
      ) : activeSong ? (
        <SongViewer
          document={parseSongDocument(activeSong)}
          transpose={transpose + (activeItem?.overrideTranspose ?? 0)}
          capo={activeItem?.overrideCapo ?? activeSong.capo ?? 0}
        />
      ) : (
        <View style={styles.center}>
          <Text>Add songs to this setlist from the Sets tab.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
  meta: { color: '#94a3b8', marginTop: 4 },
  strip: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  stripItem: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stripItemActive: { backgroundColor: '#f59e0b' },
  stripText: { color: '#f8fafc', fontWeight: '600' },
  controls: {
    flexDirection: 'row',
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
  noteBox: { padding: 20 },
  noteText: { color: '#f8fafc', fontSize: 22, lineHeight: 32 },
});
