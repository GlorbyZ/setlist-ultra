import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { ActionSheet, BrandDialog } from '@/src/components/BrandDialog';
import { BrandButton } from '@/src/components/BrandButton';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { SongViewer } from '@/src/components/SongViewer';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { addSongToSetlist, deleteSong, parseSongDocument, patchAppState, updateSong } from '@/src/lib/repository';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import type { SongRow } from '@setlist-ultra/db';

type ListId = 'all' | 'recents' | 'favorites' | 'unfiled';
type SortId = 'title' | 'artist' | 'modified' | 'number';
type SourceId = 'all' | 'ug' | 'sbp' | 'manual';

const LISTS: { id: ListId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recents', label: 'Recents' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'unfiled', label: 'Unfiled' },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'modified', label: 'Modified' },
  { id: 'number', label: 'Number' },
];

export default function SongsScreen() {
  const { songs, setlists, loading, error, refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const split = width >= 900;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listId, setListId] = useState<ListId>('all');
  const [sortId, setSortId] = useState<SortId>('title');
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<SourceId>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterArtist, setFilterArtist] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState<'key' | 'tag' | 'artist' | 'source' | null>(null);
  const [dialog, setDialog] = useState<{ title: string; body?: string; songId?: string } | null>(null);

  const keys = useMemo(
    () => [...new Set(songs.map((song) => song.originalKey).filter(Boolean) as string[])].sort(),
    [songs],
  );
  const tags = useMemo(() => [...new Set(songs.flatMap(tagList))].sort(), [songs]);
  const artists = useMemo(
    () => [...new Set(songs.map((song) => song.artist).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [songs],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let rows = songs.filter((song) => `${song.title} ${song.artist} ${song.importSource ?? ''}`.toLowerCase().includes(q));
    if (listId === 'recents') {
      rows = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 30);
    } else if (listId === 'favorites') {
      rows = rows.filter(isFavorite);
    } else if (listId === 'unfiled') {
      rows = rows.filter((song) => !song.folderId);
    }
    if (filterKey) rows = rows.filter((song) => song.originalKey === filterKey);
    if (filterTag) rows = rows.filter((song) => tagList(song).includes(filterTag));
    if (filterArtist) rows = rows.filter((song) => song.artist === filterArtist);
    if (filterSource !== 'all') rows = rows.filter((song) => sourceKind(song) === filterSource);
    if (listId !== 'recents') {
      rows = [...rows].sort((a, b) => {
        if (sortId === 'artist') return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
        if (sortId === 'modified') return b.updatedAt.localeCompare(a.updatedAt);
        if (sortId === 'number') return (a.songNumber ?? 99999) - (b.songNumber ?? 99999) || a.title.localeCompare(b.title);
        return a.title.localeCompare(b.title);
      });
    }
    return rows;
  }, [songs, query, listId, sortId, filterKey, filterTag, filterArtist, filterSource]);

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0];
  const selectedIds = Object.keys(picked).filter((id) => picked[id]);

  const openSong = (item: SongRow) => {
    setSelectedId(item.id);
    void patchAppState({ currentSongId: item.id, currentSetlistId: null, currentSetIndex: 0 });
    if (!split) router.push(`/song/${item.id}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.pane, split && styles.listPane]}>
        <View style={styles.toolbar}>
          <LibrarySwitcher />
          <View style={styles.chipRow}>
            {LISTS.map((list) => (
              <Pressable
                key={list.id}
                style={[styles.chip, listId === list.id && styles.chipOn]}
                onPress={() => setListId(list.id)}>
                <Text style={[styles.chipText, listId === list.id && styles.chipTextOn]}>{list.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipRow}>
            <Pressable style={styles.chip} onPress={() => setFilterOpen('key')}>
              <Text style={styles.chipText}>{filterKey ? `Key ${filterKey}` : 'Key'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setFilterOpen('tag')}>
              <Text style={styles.chipText}>{filterTag ?? 'Tag'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setFilterOpen('artist')}>
              <Text style={styles.chipText}>{filterArtist ?? 'Artist'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setFilterOpen('source')}>
              <Text style={styles.chipText}>{filterSource === 'all' ? 'Source' : filterSource.toUpperCase()}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => setSortOpen(true)}>
              <Text style={styles.chipText}>Sort</Text>
            </Pressable>
          </View>
          <TextInput
            placeholder="Search songs"
            placeholderTextColor={theme.faint}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <View style={styles.chipRow}>
            <View style={{ flex: 1 }}>
              <BrandButton label="Import" onPress={() => router.push('/import')} />
            </View>
            <View style={{ flex: 1 }}>
              <BrandButton
                label={selecting ? 'Done' : 'Select'}
                onPress={() => {
                  setSelecting((on) => !on);
                  setPicked({});
                }}
              />
            </View>
          </View>
          {selecting ? (
            <BrandButton
              label={selectedIds.length ? `Add ${selectedIds.length} to set` : 'Add to set'}
              disabled={!selectedIds.length}
              onPress={() => setSetPickerOpen(true)}
            />
          ) : null}
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
            renderItem={({ item }) => {
              const on = selecting && picked[item.id];
              return (
                <Pressable
                  style={[styles.row, selected?.id === item.id && split && styles.rowOn, on && styles.rowOn]}
                  onPress={() => {
                    if (selecting) {
                      setPicked((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                      return;
                    }
                    openSong(item);
                  }}
                  onLongPress={() => setDialog({ title: item.title, songId: item.id })}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.artist}
                    {item.originalKey ? ` · ${item.originalKey}` : ''}
                    {item.keyShift ? ` · ${item.keyShift > 0 ? '+' : ''}${item.keyShift}` : ''}
                    {isFavorite(item) ? ' · Fav' : ''}
                  </Text>
                </Pressable>
              );
            }}
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

      <ActionSheet
        visible={sortOpen}
        title="Sort by"
        onClose={() => setSortOpen(false)}
        options={SORTS.map((sort) => ({
          label: sort.label,
          onPress: () => setSortId(sort.id),
        }))}
      />
      <ActionSheet
        visible={filterOpen === 'key'}
        title="Filter by key"
        onClose={() => setFilterOpen(null)}
        options={[
          { label: 'Any key', onPress: () => setFilterKey(null) },
          ...keys.map((key) => ({ label: key, onPress: () => setFilterKey(key) })),
        ]}
      />
      <ActionSheet
        visible={filterOpen === 'tag'}
        title="Filter by tag"
        onClose={() => setFilterOpen(null)}
        options={[
          { label: 'Any tag', onPress: () => setFilterTag(null) },
          ...tags.map((tag) => ({ label: tag, onPress: () => setFilterTag(tag) })),
        ]}
      />
      <ActionSheet
        visible={filterOpen === 'artist'}
        title="Filter by artist"
        onClose={() => setFilterOpen(null)}
        options={[
          { label: 'Any artist', onPress: () => setFilterArtist(null) },
          ...artists.slice(0, 40).map((artist) => ({ label: artist, onPress: () => setFilterArtist(artist) })),
        ]}
      />
      <ActionSheet
        visible={filterOpen === 'source'}
        title="Filter by source"
        onClose={() => setFilterOpen(null)}
        options={[
          { label: 'Any source', onPress: () => setFilterSource('all') },
          { label: 'UG', onPress: () => setFilterSource('ug') },
          { label: 'SBP', onPress: () => setFilterSource('sbp') },
          { label: 'Manual', onPress: () => setFilterSource('manual') },
        ]}
      />

      <SetTargetPicker
        visible={setPickerOpen}
        setlists={setlists}
        onClose={() => setSetPickerOpen(false)}
        onPick={async (setlistId) => {
          for (const songId of selectedIds) {
            await addSongToSetlist(setlistId, songId);
          }
          setSelecting(false);
          setPicked({});
          await refresh();
          router.push(`/setlist/${setlistId}`);
        }}
      />

      <BrandDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        body={dialog?.body ?? 'Favorite, delete, or cancel.'}
        onClose={() => setDialog(null)}
        actions={
          dialog?.songId
            ? [
                {
                  label: (() => {
                    const song = songs.find((s) => s.id === dialog.songId);
                    return song && isFavorite(song) ? 'Unfavorite' : 'Favorite';
                  })(),
                  onPress: () => {
                    const song = songs.find((s) => s.id === dialog.songId);
                    if (song) void updateSong(song.id, { tags: toggleFavoriteTags(song) }).then(() => refresh());
                    setDialog(null);
                  },
                },
                {
                  label: 'Delete',
                  danger: true,
                  onPress: () => {
                    const id = dialog.songId;
                    setDialog(null);
                    if (id) void deleteSong(id).then(() => refresh());
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

function SetTargetPicker({
  visible,
  setlists,
  onClose,
  onPick,
}: {
  visible: boolean;
  setlists: { id: string; title: string }[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <ActionSheet
      visible={visible}
      title="Add to set"
      onClose={onClose}
      options={
        setlists.length
          ? setlists.map((set) => ({ label: set.title, onPress: () => void onPick(set.id) }))
          : [{ label: 'No sets yet', onPress: onClose }]
      }
    />
  );
}

function tagList(song: SongRow) {
  return (song.tags ?? '')
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isFavorite(song: SongRow) {
  return tagList(song).some((tag) => tag.toLowerCase() === 'favorite');
}

function toggleFavoriteTags(song: SongRow) {
  const tags = tagList(song);
  if (isFavorite(song)) return tags.filter((tag) => tag.toLowerCase() !== 'favorite').join(',');
  return [...tags, 'favorite'].join(',');
}

function sourceKind(song: SongRow): Exclude<SourceId, 'all'> {
  const src = `${song.importSource ?? ''} ${song.sourceProvider ?? ''}`.toLowerCase();
  if (src.includes('ultimate') || src.includes('ug')) return 'ug';
  if (src.includes('sbp')) return 'sbp';
  return 'manual';
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg, flexDirection: 'row' as const },
    pane: { flex: 1 },
    listPane: { maxWidth: 420, borderRightWidth: 1, borderRightColor: t.border },
    toolbar: { padding: 16, gap: 8 },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    chip: {
      backgroundColor: t.panel,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipOn: { borderColor: t.accent, backgroundColor: t.bg },
    chipText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
    chipTextOn: { color: t.accent },
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
