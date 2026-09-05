import { type Href, Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { SongViewer } from '@/src/components/SongViewer';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { deleteSong, parseSongDocument } from '@/src/lib/repository';
import { colors } from '@/src/theme';

export default function SongsScreen() {
  const { songs, loading, error, refresh } = useLibrary();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const split = width >= 900;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return songs.filter((song) => `${song.title} ${song.artist} ${song.importSource ?? ''}`.toLowerCase().includes(q));
  }, [songs, query]);

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0];

  return (
    <View style={styles.container}>
      <View style={[styles.pane, split && styles.listPane]}>
        <View style={styles.toolbar}>
          <LibrarySwitcher />
          <TextInput
            placeholder="Search songs, artist, source..."
            placeholderTextColor={colors.faint}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <View style={styles.actions}>
            <Link href="/import" asChild>
              <Pressable style={styles.importButton}>
                <Text style={styles.importText}>+ Add</Text>
              </Pressable>
            </Link>
          </View>
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
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No songs yet</Text>
                <Text style={styles.emptyBody}>Import a Songbook Pro backup, paste ChordPro, or search online.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, selected?.id === item.id && split && styles.rowOn]}
                onPress={() => {
                  setSelectedId(item.id);
                  if (!split) router.push(`/song/${item.id}`);
                }}
                onLongPress={() => {
                  Alert.alert(item.title, 'Delete this song from the library?', [
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
                  {item.keyShift ? ` · ${item.keyShift > 0 ? '+' : ''}${item.keyShift}` : ''}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      {split && selected ? (
        <View style={styles.preview}>
          <View style={styles.previewBar}>
            <Text style={styles.previewTitle}>{selected.title}</Text>
            <Pressable style={styles.ghost} onPress={() => router.push(`/song/${selected.id}`)}>
              <Text style={styles.ghostText}>Live</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => router.push(`/editor/${selected.id}` as Href)}>
              <Text style={styles.ghostText}>Edit</Text>
            </Pressable>
          </View>
          <SongViewer document={parseSongDocument(selected)} transpose={selected.keyShift ?? 0} capo={selected.capo ?? 0} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, flexDirection: 'row' },
  pane: { flex: 1 },
  listPane: { maxWidth: 420, borderRightWidth: 1, borderRightColor: colors.border },
  toolbar: { padding: 16, gap: 12 },
  search: {
    backgroundColor: colors.border,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', gap: 8 },
  importButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importText: { color: colors.accentText, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowOn: { borderColor: colors.accent },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: colors.muted, marginTop: 8, textAlign: 'center' },
  preview: { flex: 1 },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewTitle: { color: colors.text, fontWeight: '800', flex: 1, fontSize: 18 },
  ghost: { backgroundColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  ghostText: { color: colors.text, fontWeight: '700' },
});
