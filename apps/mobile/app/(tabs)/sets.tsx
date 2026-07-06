import { useRouter } from 'expo-router';
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
import { addSongToSetlist, createSetlist } from '@/src/lib/repository';

export default function SetsScreen() {
  const { setlists, songs, loading, refresh } = useLibrary();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createSetlist(`Set ${setlists.length + 1}`);
      await refresh();
      router.push(`/setlist/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleQuickAdd = async (setlistId: string) => {
    if (!songs.length) {
      Alert.alert('No songs', 'Import a song first.');
      return;
    }

    await addSongToSetlist(setlistId, songs[0].id);
    await refresh();
    router.push(`/setlist/${setlistId}`);
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
        {creating ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.createText}>+ New Setlist</Text>
        )}
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={setlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No setlists yet</Text>
              <Text style={styles.emptyBody}>Create a setlist for your next gig.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/setlist/${item.id}`)}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.eventDate ?? 'No date'}</Text>
              <Pressable style={styles.quickAdd} onPress={() => handleQuickAdd(item.id)}>
                <Text style={styles.quickAddText}>Quick add first song</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 16 },
  createButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  createText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  list: { paddingBottom: 40 },
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
  quickAdd: { marginTop: 12 },
  quickAddText: { color: '#f59e0b', fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  emptyBody: { color: '#94a3b8', marginTop: 8, textAlign: 'center' },
});
