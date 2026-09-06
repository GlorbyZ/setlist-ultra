import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { ActionSheet, BrandDialog } from '@/src/components/BrandDialog';
import { BrandButton } from '@/src/components/BrandButton';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { SongsDrawer, type SongListId } from '@/src/components/SongsDrawer';
import { SongViewer } from '@/src/components/SongViewer';
import { UgImportSheet } from '@/src/components/UgImportSheet';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useSongsChrome } from '@/src/providers/SongsChromeProvider';
import { addSongToSetlist, deleteSong, parseSongDocument, patchAppState, updateSong } from '@/src/lib/repository';
import { groupUgResults, mergeUgHits, searchUgTabs, UG_PAGE_SIZE, type UgSearchHit, type UgSongGroup } from '@/src/lib/ug-api';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import type { SongRow } from '@setlist-ultra/db';

type SortId = 'title' | 'artist' | 'modified' | 'number';
type SourceId = 'all' | 'ug' | 'sbp' | 'manual';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'modified', label: 'Modified' },
  { id: 'number', label: 'Number' },
];

const MIN_LOCAL = 1;

type ListRow =
  | { kind: 'heading'; id: string; title: string }
  | { kind: 'status'; id: string; text: string }
  | { kind: 'local'; song: SongRow }
  | { kind: 'online'; group: UgSongGroup }
  | { kind: 'action'; id: string; label: string };

export default function SongsScreen() {
  const { songs, setlists, loading, error, refresh } = useLibrary();
  const { setDrawerOpen } = useSongsChrome();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const split = width >= 900;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listId, setListId] = useState<SongListId>('all');
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
  const [onlineHits, setOnlineHits] = useState<UgSearchHit[]>([]);
  const [onlineNext, setOnlineNext] = useState<number | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<'idle' | 'searching' | 'ready' | 'empty' | 'error'>('idle');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [importGroup, setImportGroup] = useState<UgSongGroup | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [wantOnline, setWantOnline] = useState(false);
  const searchGen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      return () => setDrawerOpen(false);
    }, [setDrawerOpen]),
  );

  const keys = useMemo(
    () => [...new Set(songs.map((song) => song.originalKey).filter(Boolean) as string[])].sort(),
    [songs],
  );
  const tags = useMemo(() => [...new Set(songs.flatMap(tagList))].sort(), [songs]);
  const artists = useMemo(
    () => [...new Set(songs.map((song) => song.artist).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [songs],
  );

  const scoped = useMemo(() => {
    let rows = songs;
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
  }, [songs, listId, sortId, filterKey, filterTag, filterArtist, filterSource]);

  const q = query.trim().toLowerCase();
  const localHits = useMemo(() => {
    if (!q) return scoped;
    return scoped.filter((song) => matchesQuery(song, q));
  }, [scoped, q]);

  const onlineGroups = useMemo(() => groupUgResults(onlineHits), [onlineHits]);

  const runOnline = useCallback(async (raw: string, page: number, append = false) => {
    const term = raw.trim();
    if (!term) return;
    const gen = ++searchGen.current;
    if (page === 1) {
      setOnlineStatus('searching');
      setOnlineError(null);
      if (!append) setOnlineHits([]);
    } else {
      setLoadingMore(true);
    }
    try {
      const result = await searchUgTabs(term, { page, pageSize: UG_PAGE_SIZE });
      if (gen !== searchGen.current) return;
      setOnlineHits((prev) => (page === 1 && !append ? result.hits : mergeUgHits(prev, result.hits)));
      setOnlineNext(result.nextPage);
      setOnlineStatus(result.groups.length || result.hits.length ? 'ready' : 'empty');
    } catch (err) {
      if (gen !== searchGen.current) return;
      setOnlineStatus('error');
      setOnlineError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      searchGen.current += 1;
      setOnlineHits([]);
      setOnlineNext(null);
      setOnlineStatus('idle');
      setOnlineError(null);
      setWantOnline(false);
      return;
    }
    if (localHits.length >= MIN_LOCAL) {
      if (!wantOnline) {
        setOnlineHits([]);
        setOnlineNext(null);
        setOnlineStatus('idle');
      }
      return;
    }
    const handle = setTimeout(() => void runOnline(term, 1), 400);
    return () => clearTimeout(handle);
  }, [query, localHits.length, runOnline]);

  const rows: ListRow[] = useMemo(() => {
    const searching = q.length > 0;
    if (!searching) {
      if (!localHits.length) return [];
      return localHits.map((song) => ({ kind: 'local' as const, song }));
    }
    const out: ListRow[] = [];
    if (localHits.length >= MIN_LOCAL) {
      out.push({ kind: 'heading', id: 'local-h', title: 'In your library' });
      for (const song of localHits) out.push({ kind: 'local', song });
      out.push({ kind: 'action', id: 'search-online', label: 'Search online' });
      if (onlineStatus === 'searching') out.push({ kind: 'status', id: 'searching', text: 'Searching online…' });
      if (onlineStatus === 'error') out.push({ kind: 'status', id: 'err', text: onlineError || 'Search failed' });
      if (onlineStatus === 'empty' && wantOnline) out.push({ kind: 'status', id: 'none', text: 'Nothing found.' });
      if (wantOnline && onlineGroups.length) {
        out.push({ kind: 'heading', id: 'online-h', title: 'Online' });
        for (const group of onlineGroups) out.push({ kind: 'online', group });
      }
    } else {
      out.push({ kind: 'status', id: 'no-local', text: 'No local matches' });
      if (onlineStatus === 'searching') out.push({ kind: 'status', id: 'searching', text: 'Searching online…' });
      if (onlineStatus === 'error') out.push({ kind: 'status', id: 'err', text: onlineError || 'Search failed' });
      if (onlineStatus === 'empty') out.push({ kind: 'status', id: 'none', text: 'Nothing found.' });
      if (onlineGroups.length) {
        out.push({ kind: 'heading', id: 'online-h', title: 'Online' });
        for (const group of onlineGroups) out.push({ kind: 'online', group });
      }
    }
    return out;
  }, [q, localHits, onlineGroups, onlineStatus, onlineError, wantOnline]);

  const selected = localHits.find((s) => s.id === selectedId) ?? localHits[0];
  const selectedIds = Object.keys(picked).filter((id) => picked[id]);

  const openSong = (item: SongRow) => {
    setSelectedId(item.id);
    void patchAppState({ currentSongId: item.id, currentSetlistId: null, currentSetIndex: 0 });
    if (!split) router.push(`/song/${item.id}`);
  };

  const submitSearch = () => {
    Keyboard.dismiss();
    const term = query.trim();
    if (!term) return;
    if (localHits.length < MIN_LOCAL) void runOnline(term, 1);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.pane, split && styles.listPane]}>
        <View style={styles.toolbar}>
          <LibrarySwitcher />
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
            returnKeyType="search"
            blurOnSubmit
            autoCorrect={false}
            autoCapitalize="none"
            enablesReturnKeyAutomatically
            submitBehavior="blurAndSubmit"
            onSubmitEditing={submitSearch}
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
            data={rows}
            keyExtractor={(item) =>
              item.kind === 'local' ? `local-${item.song.id}` : item.kind === 'online' ? `online-${item.group.id}` : item.id
            }
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              const showOnline = q && (localHits.length < MIN_LOCAL || wantOnline);
              if (!showOnline || !onlineNext || loadingMore || onlineStatus === 'searching') return;
              void runOnline(query, onlineNext, true);
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No songs yet.</Text>
                <Text style={styles.emptyBody}>Import a chart or .sbp.</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.accent} /> : onlineNext && q && (localHits.length < MIN_LOCAL || wantOnline) ? (
                <Pressable style={styles.loadMore} onPress={() => void runOnline(query, onlineNext, true)}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              if (item.kind === 'heading') return <Text style={styles.section}>{item.title}</Text>;
              if (item.kind === 'status') return <Text style={styles.status}>{item.text}</Text>;
              if (item.kind === 'action') {
                return (
                  <Pressable style={styles.ghost} onPress={() => { setWantOnline(true); void runOnline(query, 1); }}>
                    <Text style={styles.ghostText}>{item.label}</Text>
                  </Pressable>
                );
              }
              if (item.kind === 'online') {
                const rating = item.group.rating != null ? `${item.group.rating.toFixed(1)}★` : null;
                return (
                  <Pressable style={styles.row} onPress={() => setImportGroup(item.group)}>
                    <Text style={styles.title}>{item.group.songName}</Text>
                    <Text style={styles.meta}>
                      {item.group.artistName || 'Unknown artist'}
                      {` · ${item.group.versions.length} version${item.group.versions.length === 1 ? '' : 's'}`}
                      {rating ? ` · ${rating}` : ''}
                    </Text>
                  </Pressable>
                );
              }
              const song = item.song;
              const on = selecting && picked[song.id];
              return (
                <Pressable
                  style={[styles.row, selected?.id === song.id && split && styles.rowOn, on && styles.rowOn]}
                  onPress={() => {
                    if (selecting) {
                      setPicked((prev) => ({ ...prev, [song.id]: !prev[song.id] }));
                      return;
                    }
                    openSong(song);
                  }}
                  onLongPress={() => setDialog({ title: song.title, songId: song.id })}>
                  <Text style={styles.title}>{song.title}</Text>
                  <Text style={styles.meta}>
                    {song.artist}
                    {song.originalKey ? ` · ${song.originalKey}` : ''}
                    {song.keyShift ? ` · ${song.keyShift > 0 ? '+' : ''}${song.keyShift}` : ''}
                    {isFavorite(song) ? ' · Fav' : ''}
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
            <Pressable style={styles.ghostChip} onPress={() => router.push(`/song/${selected.id}`)}>
              <Text style={styles.ghostChipText}>Live</Text>
            </Pressable>
            <Pressable style={styles.ghostChip} onPress={() => router.push(`/editor/${selected.id}` as Href)}>
              <Text style={styles.ghostChipText}>Edit</Text>
            </Pressable>
          </View>
          <SongViewer document={parseSongDocument(selected)} transpose={selected.keyShift ?? 0} capo={selected.capo ?? 0} />
        </View>
      ) : null}

      <SongsDrawer listId={listId} onSelectList={setListId} />
      <UgImportSheet
        group={importGroup}
        onClose={() => setImportGroup(null)}
        onImported={(songId) => {
          void refresh();
          router.push(`/song/${songId}`);
        }}
      />

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

function matchesQuery(song: SongRow, q: string) {
  const blob = `${song.title} ${song.artist} ${song.tags ?? ''} ${song.notesText ?? ''} ${song.importSource ?? ''} ${song.chordpro?.slice(0, 500) ?? ''}`.toLowerCase();
  return blob.includes(q);
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
    container: { flex: 1, backgroundColor: t.bg, flexDirection: 'row' as const, position: 'relative' as const },
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
    chipText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
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
    section: { color: t.text, fontWeight: '800' as const, fontSize: 14, marginBottom: 8, marginTop: 4 },
    status: { color: t.muted, marginBottom: 10 },
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
    ghost: { paddingVertical: 10, alignItems: 'center' as const, marginBottom: 12 },
    ghostText: { color: t.accent, fontWeight: '700' as const },
    ghostChip: {
      backgroundColor: t.panel,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    ghostChipText: { color: t.text, fontWeight: '700' as const },
    loadMore: { alignItems: 'center' as const, paddingVertical: 16 },
    loadMoreText: { color: t.accent, fontWeight: '700' as const },
  };
}
