import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { SongViewer } from '@/src/components/SongViewer';
import { BrandButton } from '@/src/components/BrandButton';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { deleteSong, parseSongDocument, patchAppState } from '@/src/lib/repository';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function SongsScreen() {
  const { songs, loading, error, refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            placeholder="Search songs"
            placeholderTextColor={theme.faint}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <BrandButton label="Import" onPress={() => router.push('/import')} />
        </View>

        {error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not open library</Text>
            <Text style={styles.emptyBody}>{error}</Text>
            <BrandButton label="Retry" onPress={() => void refresh()} />
          </View>
        ) : loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No songs yet.</Text>
                <Text style={styles.emptyBody}>Import a chart or .sbp.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, selected?.id === item.id && split && styles.rowOn]}
                onPress={() => {
                  setSelectedId(item.id);
                  void patchAppState({ currentSongId: item.id, currentSetlistId: null, currentSetIndex: 0 });
                  if (!split) router.push(`/song/${item.id}`);
                }}
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

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg, flexDirection: 'row' as const },
    pane: { flex: 1 },
    listPane: { maxWidth: 420, borderRightWidth: 1, borderRightColor: t.border },
    toolbar: { padding: 16, gap: 8 },
    search: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    list: { paddingHorizontal: 16, paddingBottom: 40 },
    row: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    rowOn: { borderColor: t.accent },
    title: { color: t.text, fontSize: 18, fontWeight: '700' as const },
    meta: { color: t.muted, marginTop: 4 },
    empty: { padding: 32, alignItems: 'center' as const },
    emptyTitle: { color: t.text, fontSize: 20, fontWeight: '700' as const },
    emptyBody: { color: t.muted, marginTop: 8, textAlign: 'center' as const },
    preview: { flex: 1 },
    previewBar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    previewTitle: { color: t.text, fontWeight: '800' as const, flex: 1, fontSize: 18 },
    ghost: {
      backgroundColor: t.panel,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    ghostText: { color: t.text, fontWeight: '700' as const },
  };
}
