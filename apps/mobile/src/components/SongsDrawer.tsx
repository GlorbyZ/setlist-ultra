import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Themed';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { useSongsChrome } from '@/src/providers/SongsChromeProvider';
import { useThemedStyles, type AppTheme } from '@/src/theme';

export type SongListId = 'all' | 'recents' | 'favorites' | 'unfiled';

const LISTS: { id: SongListId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recents', label: 'Recents' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'unfiled', label: 'Unfiled' },
];

type Props = {
  listId: SongListId;
  onSelectList: (id: SongListId) => void;
  filterKey: string | null;
  filterTag: string | null;
  filterArtist: string | null;
  filterSourceLabel: string;
  onOpenFilter: (which: 'key' | 'tag' | 'artist' | 'source' | 'sort') => void;
};

export function SongsDrawer({
  listId,
  onSelectList,
  filterKey,
  filterTag,
  filterArtist,
  filterSourceLabel,
  onOpenFilter,
}: Props) {
  const { drawerOpen, setDrawerOpen } = useSongsChrome();
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    if (!drawerOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDrawerOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  const apply = (fn: () => void) => {
    fn();
    setDrawerOpen(false);
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.dim} onPress={() => setDrawerOpen(false)} accessibilityLabel="Close menu" />
      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Library</Text>
          <LibrarySwitcher onChanged={() => setDrawerOpen(false)} />

          <Text style={styles.heading}>Lists</Text>
          {LISTS.map((list) => {
            const on = listId === list.id;
            return (
              <Pressable
                key={list.id}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => apply(() => onSelectList(list.id))}>
                <Text style={[styles.label, on && styles.labelOn]}>{list.label}</Text>
              </Pressable>
            );
          })}

          <Text style={styles.heading}>Filters</Text>
          <Pressable style={styles.row} onPress={() => apply(() => onOpenFilter('key'))}>
            <Text style={styles.label}>{filterKey ? `Key ${filterKey}` : 'Key'}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => apply(() => onOpenFilter('tag'))}>
            <Text style={styles.label}>{filterTag ?? 'Tag'}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => apply(() => onOpenFilter('artist'))}>
            <Text style={styles.label}>{filterArtist ?? 'Artist'}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => apply(() => onOpenFilter('source'))}>
            <Text style={styles.label}>{filterSourceLabel}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => apply(() => onOpenFilter('sort'))}>
            <Text style={styles.label}>Sort</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    root: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
    dim: {
      ...({ position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 }),
      backgroundColor: 'rgba(10,10,12,0.35)',
    },
    panel: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      width: 280,
      backgroundColor: t.bg,
      borderRightWidth: 1,
      borderRightColor: t.border,
    },
    scroll: { paddingTop: 16, paddingHorizontal: 12, paddingBottom: 32, gap: 4 },
    heading: {
      color: t.muted,
      fontWeight: '700' as const,
      fontSize: 12,
      marginBottom: 8,
      marginTop: 12,
      paddingHorizontal: 8,
    },
    row: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: t.radius.md },
    rowOn: { backgroundColor: t.panel },
    label: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    labelOn: { color: t.accent },
  };
}
