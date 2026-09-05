import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import type { SongRow } from '@setlist-ultra/db';

type Props = {
  visible: boolean;
  songs: SongRow[];
  excludeIds?: string[];
  onClose: () => void;
  onConfirm: (songIds: string[]) => void;
};

export function SongPickerModal({ visible, songs, excludeIds = [], onClose, onConfirm }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const available = useMemo(() => {
    const blocked = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return songs.filter((song) => {
      if (blocked.has(song.id)) return false;
      if (!q) return true;
      return `${song.title} ${song.artist}`.toLowerCase().includes(q);
    });
  }, [songs, excludeIds, query]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const close = () => {
    setQuery('');
    setSelected({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.shell, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.heading}>Add songs</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search library"
          placeholderTextColor={theme.faint}
          style={styles.search}
        />
        <FlatList
          data={available}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>{songs.length ? 'No matches.' : 'No songs in this library.'}</Text>
          }
          renderItem={({ item }) => {
            const on = Boolean(selected[item.id]);
            return (
              <Pressable
                style={[styles.row, on && styles.rowOn]}
                onPress={() => setSelected((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.artist}
                    {item.originalKey ? ` · ${item.originalKey}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
        <BrandButton
          label={selectedIds.length ? `Add ${selectedIds.length}` : 'Add'}
          disabled={!selectedIds.length}
          onPress={() => {
            onConfirm(selectedIds);
            close();
          }}
        />
        <Pressable onPress={close} style={styles.cancelWrap}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function makeStyles(t: AppTheme) {
  return {
    shell: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 16 },
    heading: { color: t.text, fontSize: 22, fontWeight: '800' as const, marginBottom: 12 },
    search: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    rowOn: { borderColor: t.accent },
    check: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    checkOn: { backgroundColor: t.accent, borderColor: t.accent },
    checkMark: { color: '#FFFFFF', fontWeight: '800' as const, fontSize: 12 },
    rowMain: { flex: 1 },
    title: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    meta: { color: t.muted, marginTop: 2, fontSize: 13 },
    empty: { color: t.muted, textAlign: 'center' as const, padding: 32 },
    cancelWrap: { alignItems: 'center' as const, paddingBottom: 8 },
    cancel: { color: t.accent, fontWeight: '700' as const, paddingVertical: 8 },
  };
}
