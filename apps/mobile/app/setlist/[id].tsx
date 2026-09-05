import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/Themed';
import { ActionSheet, BrandDialog } from '@/src/components/BrandDialog';
import { SongPickerModal } from '@/src/components/SongPickerModal';
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
  const [picking, setPicking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [totalSec, setTotalSec] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialog, setDialog] = useState<{ title: string; body?: string } | null>(null);
  const pendingRemove = useRef<SetlistItemRow | null>(null);

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
    router.navigate('/live' as Href);
  };

  const confirmRemove = (item: SetlistItemRow) => {
    pendingRemove.current = item;
    setDialog({
      title: 'Remove from set?',
      body: itemLabel(item, songsById),
    });
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
  const inSet = items.map((item) => item.songId).filter(Boolean) as string[];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: setlist.title,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => setAddOpen(true)} accessibilityLabel="Add" hitSlop={8}>
                <Text style={styles.headerAction}>+</Text>
              </Pressable>
              <Pressable onPress={() => setMoreOpen(true)} accessibilityLabel="More" hitSlop={8}>
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

      <ActionSheet
        visible={addOpen}
        title="Add to set"
        onClose={() => setAddOpen(false)}
        options={[
          { label: 'Songs', onPress: () => setPicking(true) },
          { label: 'Note', onPress: () => void addNoteToSetlist(setlist.id, 'Note').then(load) },
          { label: '30s break', onPress: () => void addTimerToSetlist(setlist.id, 30).then(load) },
        ]}
      />

      <ActionSheet
        visible={moreOpen}
        title={setlist.title}
        onClose={() => setMoreOpen(false)}
        options={[
          {
            label: setlist.pinned ? 'Unpin' : 'Pin',
            onPress: () =>
              void updateSetlist(setlist.id, { pinned: setlist.pinned ? 0 : 1 }).then(async () => {
                await refresh();
                await load();
              }),
          },
          {
            label: 'Export .sbp',
            onPress: () =>
              void (async () => {
                try {
                  const bytes = await exportSbpBytes('set', setlist.id);
                  await saveBinaryFile(`${setlist.title}.sbp`, bytes);
                } catch (error) {
                  setDialog({
                    title: 'Export failed',
                    body: error instanceof Error ? error.message : 'Unknown error',
                  });
                }
              })(),
          },
          {
            label: 'Delete set',
            danger: true,
            onPress: () =>
              setDialog({
                title: 'Delete this set?',
                body: 'Songs stay in your library.',
              }),
          },
        ]}
      />

      <SongPickerModal
        visible={picking}
        songs={songs}
        excludeIds={inSet}
        onClose={() => setPicking(false)}
        onConfirm={(ids) => {
          void (async () => {
            for (const songId of ids) {
              await addSongToSetlist(setlist.id, songId);
            }
            await load();
          })();
        }}
      />

      <BrandDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        body={dialog?.body}
        onClose={() => {
          pendingRemove.current = null;
          setDialog(null);
        }}
        actions={
          dialog?.title === 'Remove from set?'
            ? [
                {
                  label: 'Remove',
                  danger: true,
                  onPress: () => {
                    const item = pendingRemove.current;
                    pendingRemove.current = null;
                    setDialog(null);
                    if (item) void removeSetlistItem(item.id).then(load);
                  },
                },
                { label: 'Cancel', onPress: () => setDialog(null) },
              ]
            : dialog?.title === 'Delete this set?'
              ? [
                  {
                    label: 'Delete',
                    danger: true,
                    onPress: () => {
                      setDialog(null);
                      void deleteSetlist(setlist.id).then(async () => {
                        await refresh();
                        router.back();
                      });
                    },
                  },
                  { label: 'Cancel', onPress: () => setDialog(null) },
                ]
              : [{ label: 'OK', onPress: () => setDialog(null) }]
        }
      />
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
  };
}
