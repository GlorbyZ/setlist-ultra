import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { deleteSong } from '@/src/lib/repository';

export default function SongsScreen() {
  const { songs, loading, error, refresh } = useLibrary();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = songs.filter((song) => {
    const haystack = `${song.title} ${song.artist}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          placeholder="Search songs..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <Link href="/import" asChild>
          <Pressable style={styles.importButton}>
            <Text style={styles.importText}>+ Import</Text>
          </Pressable>
        </Link>
      </View>

      {error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Could not open library</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <Pressable style={styles.importButton} onPress={() => void refresh()}>
            <Text style={styles.importText}>Retry</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No songs yet</Text>
              <Text style={styles.emptyBody}>Import from Ultimate Guitar to get started.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/song/${item.id}`)}
              onLongPress={() => {
                Alert.alert(item.title, 'Delete this song?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteSong(item.id);
                      await refresh();
                    },
                  },
                ]);
              }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.artist}
                {item.originalKey ? ` · ${item.originalKey}` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  toolbar: { padding: 16, gap: 12 },
  search: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  importButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importText: { color: '#0f172a', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  meta: { color: '#94a3b8', marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#94a3b8', marginTop: 8, textAlign: 'center' },
});
