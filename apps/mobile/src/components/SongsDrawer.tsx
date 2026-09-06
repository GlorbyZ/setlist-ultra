import { useEffect } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { Text } from '@/components/Themed';
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
};

export function SongsDrawer({ listId, onSelectList }: Props) {
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

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.dim} onPress={() => setDrawerOpen(false)} accessibilityLabel="Close menu" />
      <View style={styles.panel}>
        <Text style={styles.heading}>Lists</Text>
        {LISTS.map((list) => {
          const on = listId === list.id;
          return (
            <Pressable
              key={list.id}
              style={[styles.row, on && styles.rowOn]}
              onPress={() => {
                onSelectList(list.id);
                setDrawerOpen(false);
              }}>
              <Text style={[styles.label, on && styles.labelOn]}>{list.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    root: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
    dim: { ...({ position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 }), backgroundColor: 'rgba(10,10,12,0.35)' },
    panel: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      width: 260,
      backgroundColor: t.bg,
      borderRightWidth: 1,
      borderRightColor: t.border,
      paddingTop: 16,
      paddingHorizontal: 12,
    },
    heading: { color: t.muted, fontWeight: '700' as const, fontSize: 12, marginBottom: 8, paddingHorizontal: 8 },
    row: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: t.radius.md },
    rowOn: { backgroundColor: t.panel },
    label: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    labelOn: { color: t.accent },
  };
}
