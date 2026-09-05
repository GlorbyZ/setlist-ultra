import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { createSetlist, exportSbpBytes, setlistDuration } from '@/src/lib/repository';
import { saveBinaryFile } from '@/src/lib/files';
import { colors } from '@/src/theme';

export default function SetsScreen() {
  const { setlists, loading, refresh } = useLibrary();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});

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

  const handleExport = async (id: string, title: string) => {
    try {
      const bytes = await exportSbpBytes('set', id);
      await saveBinaryFile(`${title}.sbp`, bytes);
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <LibrarySwitcher />
      <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
        {creating ? (
          <ActivityIndicator color={colors.accentText} />
        ) : (
          <Text style={styles.createText}>+ New set</Text>
        )}
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={setlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No sets yet</Text>
              <Text style={styles.emptyBody}>Build a setlist, then export a .sbp share for Songbook Pro.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/setlist/${item.id}`)}
              onLayout={() => {
                if (durations[item.id] != null) return;
                void setlistDuration(item.id).then((sec) =>
                  setDurations((prev) => ({ ...prev, [item.id]: sec })),
                );
              }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.eventDate ?? 'No date'}
                {item.pinned ? ' · Pinned' : ''}
                {durations[item.id] != null ? ` · ${Math.round(durations[item.id] / 60)} min` : ''}
              </Text>
              <Pressable style={styles.export} onPress={() => void handleExport(item.id, item.title)}>
                <Text style={styles.exportText}>Export .sbp</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  createText: { color: colors.accentText, fontWeight: '700', fontSize: 16 },
  list: { paddingBottom: 40 },
  row: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, marginTop: 4 },
  export: { marginTop: 12 },
  exportText: { color: colors.accent, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: colors.muted, marginTop: 8, textAlign: 'center' },
});
