import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/Themed';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { formatSetMeta } from '@/src/lib/format';
import {
  addNoteToSetlist,
  addSongToSetlist,
  addTimerToSetlist,
  deleteSetlist,
  exportSbpBytes,
  getSetlist,
  getSetlistItems,
  getSong,
  patchAppState,
  removeSetlistItem,
  setlistDuration,
  updateSetlist,
} from '@/src/lib/repository';
import { saveBinaryFile } from '@/src/lib/files';
import { BRAND_GRADIENT, useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import type { SetlistItemRow, SetlistRow, SongRow } from '@setlist-ultra/db';

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { songs, refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [setlist, setSetlist] = useState<SetlistRow | null>(null);
  const [items, setItems] = useState<SetlistItemRow[]>([]);
  const [songsById, setSongsById] = useState<Record<string, SongRow>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [totalSec, setTotalSec] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
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
    setTotalSec(await setlistDuration(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const playItem = async (item: SetlistItemRow, index: number) => {
    if (item.itemType !== 'song' || !item.songId || !setlist) return;
    setActiveIndex(index);
    await patchAppState({
      currentSetlistId: setlist.id,
      currentSetIndex: index,
      currentSongId: item.songId,
    });
    router.push('/(tabs)/live' as Href);
  };

  const confirmRemove = (item: SetlistItemRow) => {
    Alert.alert('Remove from set?', itemLabel(item, songsById), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeSetlistItem(item.id).then(load),
      },
    ]);
  };

  const overflow = () => {
    if (!setlist) return;
    Alert.alert(setlist.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: setlist.pinned ? 'Unpin' : 'Pin',
        onPress: () =>
          void updateSetlist(setlist.id, { pinned: setlist.pinned ? 0 : 1 }).then(async () => {
            await refresh();
            await load();
          }),
      },
      {
        text: 'Export .sbp',
        onPress: () =>
          void (async () => {
            try {
              const bytes = await exportSbpBytes('set', setlist.id);
              await saveBinaryFile(`${setlist.title}.sbp`, bytes);
            } catch (error) {
              Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
            }
          })(),
      },
      {
        text: 'Delete set',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete this set?', 'Songs stay in your library.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () =>
                void deleteSetlist(setlist.id).then(async () => {
                  await refresh();
                  router.back();
                }),
            },
          ]),
      },
    ]);
  };

  const addMenu = () => {
    if (!setlist) return;
    Alert.alert('Add to set', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Song', onPress: () => setAdding(true) },
      { text: 'Note', onPress: () => void addNoteToSetlist(setlist.id, 'Note').then(load) },
      { text: '30s break', onPress: () => void addTimerToSetlist(setlist.id, 30).then(load) },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />;
  if (!setlist) {
    return (
      <View style={styles.center}>
        <Text>Set not found.</Text>
      </View>
    );
  }

  const songCount = items.filter((item) => item.itemType === 'song').length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: setlist.title,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={addMenu} accessibilityLabel="Add" hitSlop={8}>
                <Text style={styles.headerAction}>+</Text>
              </Pressable>
              <Pressable onPress={overflow} accessibilityLabel="More" hitSlop={8}>
                <Text style={styles.headerAction}>⋮</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <Text style={styles.meta}>{formatSetMeta(setlist.eventDate, songCount, totalSec)}</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Empty set.</Text>
            <Text style={styles.emptyBody}>Tap + to add songs.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Swipeable
            overshootRight={false}
            renderRightActions={() => (
              <Pressable style={styles.swipeRemove} onPress={() => confirmRemove(item)}>
                <Text style={styles.swipeRemoveText}>Remove</Text>
              </Pressable>
            )}>
            <Pressable
              style={styles.row}
              onPress={() => void playItem(item, index)}
              onLongPress={() => confirmRemove(item)}>
              {index === activeIndex ? (
                <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.selectedBar} />
              ) : (
                <View style={styles.selectedBarSpacer} />
              )}
              <View style={[styles.rowBody, index === activeIndex && styles.rowOn]}>
                <View style={styles.rowMain}>
                  <Text style={styles.title} numberOfLines={1}>
                    {itemLabel(item, songsById)}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {itemSubtitle(item, songsById)}
                  </Text>
                </View>
                {item.itemType === 'song' ? (
                  <Text style={styles.key}>{songsById[item.songId ?? '']?.originalKey ?? ''}</Text>
                ) : null}
              </View>
            </Pressable>
          </Swipeable>
        )}
      />

      {adding ? (
        <View style={styles.picker}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter library…"
            placeholderTextColor={theme.faint}
            style={styles.search}
          />
          <FlatList
            data={songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()))}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 220 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.pickRow}
                onPress={async () => {
                  await addSongToSetlist(setlist.id, item.id);
                  await load();
                  setAdding(false);
                  setQuery('');
                }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.artist}</Text>
              </Pressable>
            )}
          />
          <Pressable onPress={() => setAdding(false)}>
            <Text style={styles.cancel}>Close</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function itemLabel(item: SetlistItemRow, songsById: Record<string, SongRow>) {
  if (item.itemType === 'note') return item.noteContent?.trim() || 'Note';
  if (item.itemType === 'timer') return `${item.timerSeconds}s break`;
  return songsById[item.songId ?? '']?.title ?? 'Song';
}

function itemSubtitle(item: SetlistItemRow, songsById: Record<string, SongRow>) {
  if (item.itemType === 'note') return 'Note';
  if (item.itemType === 'timer') return 'Break';
  return songsById[item.songId ?? '']?.artist ?? '';
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: t.bg },
    headerActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, paddingRight: 4 },
    headerAction: { color: t.text, fontSize: 22, fontWeight: '600' as const },
    meta: { color: t.muted, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, fontSize: 13 },
    list: { paddingBottom: 40 },
    row: { flexDirection: 'row' as const, alignItems: 'stretch' as const, backgroundColor: t.bg },
    selectedBar: { width: 4 },
    selectedBarSpacer: { width: 4 },
    rowBody: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      paddingRight: 16,
      paddingLeft: 12,
      gap: 8,
    },
    rowOn: { backgroundColor: t.panel },
    rowMain: { flex: 1 },
    title: { color: t.text, fontSize: 16, fontWeight: '700' as const },
    rowMeta: { color: t.muted, marginTop: 2, fontSize: 13 },
    key: { color: t.muted, fontWeight: '700' as const, fontSize: 14 },
    empty: { padding: 32, alignItems: 'center' as const },
    emptyTitle: { color: t.text, fontSize: 20, fontWeight: '700' as const },
    emptyBody: { color: t.muted, marginTop: 8 },
    swipeRemove: {
      backgroundColor: t.danger,
      justifyContent: 'center' as const,
      paddingHorizontal: 18,
    },
    swipeRemoveText: { color: '#FFFFFF', fontWeight: '700' as const },
    picker: { padding: 12, borderTopWidth: 1, borderTopColor: t.border, maxHeight: 320 },
    search: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
    },
    pickRow: { paddingVertical: 10 },
    cancel: { color: t.accent, fontWeight: '700' as const, textAlign: 'center' as const, paddingVertical: 8 },
  };
}
