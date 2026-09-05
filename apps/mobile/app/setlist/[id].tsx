import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { LiveChrome } from '@/src/components/LiveChrome';
import { SongViewer } from '@/src/components/SongViewer';
import { useLibrary } from '@/src/providers/LibraryProvider';
import {
  addNoteToSetlist,
  addSongToSetlist,
  addTimerToSetlist,
  getSetlist,
  getSetlistItems,
  getSong,
  parseSongDocument,
  patchAppState,
  removeSetlistItem,
  reorderSetlistItems,
  setlistDuration,
  updateSetlist,
  updateSetlistItem,
} from '@/src/lib/repository';
import { subscribePedals } from '@/src/lib/pedals';
import { colors } from '@/src/theme';
import type { SetlistItemRow, SetlistRow, SongRow } from '@setlist-ultra/db';

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { songs, refresh } = useLibrary();
  const [setlist, setSetlist] = useState<SetlistRow | null>(null);
  const [items, setItems] = useState<SetlistItemRow[]>([]);
  const [songsById, setSongsById] = useState<Record<string, SongRow>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transpose, setTranspose] = useState(0);
  const [hideChords, setHideChords] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [totalSec, setTotalSec] = useState(0);

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
    setTotalSec(await setlistDuration(id));
    setLoading(false);
    if (setlistRow) await patchAppState({ currentSetlistId: setlistRow.id, currentSetIndex: 0 });
  };

  useEffect(() => {
    return subscribePedals((action) => {
      if (action === 'next') setActiveIndex((v) => Math.min(items.length - 1, v + 1));
      if (action === 'prev') setActiveIndex((v) => Math.max(0, v - 1));
      if (action === 'scrollDown') setScrolling(true);
    });
  }, [items.length]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  if (!setlist) {
    return (
      <View style={styles.center}>
        <Text>Setlist not found.</Text>
      </View>
    );
  }

  const activeItem = items[activeIndex];
  const activeSong = activeItem?.songId ? songsById[activeItem.songId] : null;
  const duration = activeSong?.duration2 ?? activeSong?.durationSeconds ?? 90;
  const itemTranspose = (activeItem?.keyOffset ?? activeItem?.overrideTranspose ?? 0) + transpose;

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const ids = items.map((i) => i.id);
    const [removed] = ids.splice(index, 1);
    ids.splice(next, 0, removed);
    await reorderSetlistItems(setlist.id, ids);
    await load();
    setActiveIndex(next);
  };

  return (
    <View style={styles.container}>
      <LiveChrome
        title={setlist.title}
        subtitle={`${activeIndex + 1}/${items.length || 0} · ${Math.round(totalSec / 60)} min`}
        extra={activeItem?.noteContent || undefined}
        onPrev={() => setActiveIndex((v) => Math.max(0, v - 1))}
        onNext={() => setActiveIndex((v) => Math.min(items.length - 1, v + 1))}
        onTranspose={(d) => setTranspose((v) => v + d)}
        onCapo={
          activeItem
            ? (d) => {
                const next = Math.max(0, (activeItem.overrideCapo ?? activeSong?.capo ?? 0) + d);
                void updateSetlistItem(activeItem.id, { overrideCapo: next });
                void load();
              }
            : undefined
        }
        onToggleLyrics={() => setHideChords((v) => !v)}
        lyricsOnly={hideChords}
        onToggleScroll={() => setScrolling((v) => !v)}
        scrolling={scrolling}
        onEdit={activeSong ? () => router.push(`/editor/${activeSong.id}` as Href) : undefined}
        onPedal={(action) => {
          if (action === 'next') setActiveIndex((v) => Math.min(items.length - 1, v + 1));
          if (action === 'prev') setActiveIndex((v) => Math.max(0, v - 1));
        }}
      />

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
              setTranspose(0);
              setScrolling(false);
              void patchAppState({ currentSetIndex: index, currentSongId: item.songId });
            }}
            onLongPress={() =>
              Alert.alert('Item', 'Remove or move', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Move up', onPress: () => void move(index, -1) },
                { text: 'Move down', onPress: () => void move(index, 1) },
                { text: 'Remove', style: 'destructive', onPress: () => void removeSetlistItem(item.id).then(load) },
              ])
            }>
            <Text style={styles.stripText}>
              {item.itemType === 'note'
                ? 'Note'
                : item.itemType === 'timer'
                  ? `Timer ${item.timerSeconds}s`
                  : songsById[item.songId ?? '']?.title ?? 'Song'}
            </Text>
          </Pressable>
        )}
      />

      {activeItem?.itemType === 'note' ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{activeItem.noteContent}</Text>
        </View>
      ) : activeItem?.itemType === 'timer' ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{activeItem.timerSeconds}s break</Text>
        </View>
      ) : activeSong ? (
        <SongViewer
          document={parseSongDocument(activeSong)}
          transpose={itemTranspose}
          capo={activeItem?.overrideCapo ?? activeSong.capo ?? 0}
          hideChords={hideChords}
          autoScrollSeconds={scrolling ? duration : undefined}
        />
      ) : (
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>Add songs from this set.</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={() => setAdding((v) => !v)}>
          <Text style={styles.footerText}>{adding ? 'Close' : '+ Songs'}</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => void addNoteToSetlist(setlist.id, 'Note').then(load)}>
          <Text style={styles.footerText}>+ Note</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => void addTimerToSetlist(setlist.id, 30).then(load)}>
          <Text style={styles.footerText}>+ 30s</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() =>
            void updateSetlist(setlist.id, { pinned: setlist.pinned ? 0 : 1 }).then(async () => {
              await refresh();
              await load();
            })
          }>
          <Text style={styles.footerText}>{setlist.pinned ? 'Unpin' : 'Pin'}</Text>
        </Pressable>
      </View>

      {adding ? (
        <View style={styles.picker}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter library…"
            placeholderTextColor={colors.faint}
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
                }}>
                <Text style={styles.stripText}>{item.title}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  strip: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  stripItem: {
    backgroundColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stripItemActive: { backgroundColor: colors.accent },
  stripText: { color: colors.text, fontWeight: '600' },
  noteBox: { padding: 20 },
  noteText: { color: colors.text, fontSize: 22, lineHeight: 32 },
  footer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  footerBtn: { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  footerText: { color: colors.text, fontWeight: '700' },
  picker: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border, maxHeight: 280 },
  search: {
    backgroundColor: colors.border,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pickRow: { paddingVertical: 10 },
});
