import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Themed';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { ExpandCollapse, PressableScale } from '@/src/motion';
import { useSongsChrome } from '@/src/providers/SongsChromeProvider';
import { useThemedStyles, type AppTheme } from '@/src/theme';

export type SongListId = 'all' | 'recents' | 'favorites' | 'unfiled';

const LISTS: { id: SongListId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recents', label: 'Recents' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'unfiled', label: 'Unfiled' },
];

type MenuProps = {
  listId: SongListId;
  onSelectList: (id: SongListId) => void;
};

/** Overflow menu from the header hamburger — library scope + lists only. */
export function SongsDrawer({ listId, onSelectList }: MenuProps) {
  const { menuOpen, setMenuOpen } = useSongsChrome();
  const styles = useThemedStyles(makeMenuStyles);

  useEffect(() => {
    if (!menuOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [menuOpen, setMenuOpen]);

  const apply = (fn: () => void) => {
    fn();
    setMenuOpen(false);
  };

  return (
    <ExpandCollapse open={menuOpen} style={styles.root}>
      <Pressable style={styles.dim} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Library</Text>
          <LibrarySwitcher onChanged={() => setMenuOpen(false)} />

          <Text style={styles.heading}>Lists</Text>
          {LISTS.map((list) => {
            const on = listId === list.id;
            return (
              <PressableScale
                key={list.id}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => apply(() => onSelectList(list.id))}>
                <Text style={[styles.label, on && styles.labelOn]}>{list.label}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>
    </ExpandCollapse>
  );
}

type FilterPanelProps = {
  open: boolean;
  onClose: () => void;
  filterKey: string | null;
  filterTag: string | null;
  filterArtist: string | null;
  filterSourceLabel: string;
  sortLabel: string;
  onOpenFilter: (which: 'key' | 'tag' | 'artist' | 'source' | 'sort') => void;
};

/** Downward expansion under the action bar for sort / filters. */
export function SongsFilterPanel({
  open,
  onClose,
  filterKey,
  filterTag,
  filterArtist,
  filterSourceLabel,
  sortLabel,
  onOpenFilter,
}: FilterPanelProps) {
  const styles = useThemedStyles(makeFilterStyles);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  return (
    <ExpandCollapse open={open} style={styles.wrap}>
      <View style={styles.panel}>
        <PressableScale style={styles.row} onPress={() => onOpenFilter('sort')}>
          <Text style={styles.label}>Sort · {sortLabel}</Text>
        </PressableScale>
        <PressableScale style={styles.row} onPress={() => onOpenFilter('key')}>
          <Text style={styles.label}>{filterKey ? `Key ${filterKey}` : 'Key'}</Text>
        </PressableScale>
        <PressableScale style={styles.row} onPress={() => onOpenFilter('tag')}>
          <Text style={styles.label}>{filterTag ?? 'Tag'}</Text>
        </PressableScale>
        <PressableScale style={styles.row} onPress={() => onOpenFilter('artist')}>
          <Text style={styles.label}>{filterArtist ?? 'Artist'}</Text>
        </PressableScale>
        <PressableScale style={styles.row} onPress={() => onOpenFilter('source')}>
          <Text style={styles.label}>{filterSourceLabel}</Text>
        </PressableScale>
      </View>
    </ExpandCollapse>
  );
}

function makeMenuStyles(t: AppTheme) {
  return {
    root: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
    dim: {
      position: 'absolute' as const,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(10,10,12,0.35)',
    },
    panel: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      maxHeight: '70%' as unknown as number,
      backgroundColor: t.bg,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    scroll: { paddingTop: 8, paddingHorizontal: 12, paddingBottom: 20, gap: 4 },
    heading: {
      color: t.muted,
      fontWeight: t.type.meta.fontWeight,
      fontSize: t.type.meta.fontSize,
      lineHeight: t.type.meta.lineHeight,
      marginBottom: 8,
      marginTop: 12,
      paddingHorizontal: 8,
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
    },
    row: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: t.radius.md },
    rowOn: { backgroundColor: t.panel },
    label: { color: t.text, fontWeight: t.type.body.fontWeight, fontSize: t.type.body.fontSize, lineHeight: t.type.body.lineHeight },
    labelOn: { color: t.accent },
  };
}

function makeFilterStyles(t: AppTheme) {
  return {
    wrap: {
      marginTop: 4,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.md,
      backgroundColor: t.panel,
      overflow: 'hidden' as const,
    },
    panel: { paddingVertical: 4 },
    row: { paddingVertical: 12, paddingHorizontal: 14 },
    label: { color: t.text, fontWeight: '600' as const, fontSize: 15 },
  };
}
