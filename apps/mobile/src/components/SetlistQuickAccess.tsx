import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SongRow } from '@setlist-ultra/db';

import { Text } from '@/components/Themed';
import { formatDate } from '@/src/lib/format';
import { PressableScale } from '@/src/motion';
import { useThemedStyles, type AppTheme } from '@/src/theme';
import { soundingKeyName } from '@setlist-ultra/core';

export type SetlistQuickSong = Pick<SongRow, 'id' | 'title' | 'artist' | 'originalKey' | 'keyShift'>;

type Props = {
  open: boolean;
  onClose: () => void;
  setTitle: string;
  eventDate?: string | null;
  songs: SetlistQuickSong[];
  currentSongId: string | null;
  onSelectSong: (songId: string, index: number) => void;
};

/** Songbook Pro–style Live setlist overlay: numbered songs, chart stays behind. */
export function SetlistQuickAccess({
  open,
  onClose,
  setTitle,
  eventDate,
  songs,
  currentSongId,
  onSelectSong,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!open) return null;

  const dateLabel = eventDate?.trim() ? formatDate(eventDate) : null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="Close setlist" />
      <View style={[styles.panel, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderText}>
            <Text style={styles.setTitle} numberOfLines={1}>
              {setTitle}
            </Text>
            {dateLabel ? (
              <Text style={styles.setDate} numberOfLines={1}>
                {dateLabel}
              </Text>
            ) : null}
          </View>
          <PressableScale style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <Text style={styles.closeText}>Close</Text>
          </PressableScale>
        </View>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled">
          {songs.map((song, index) => {
            const on = song.id === currentSongId;
            const key =
              soundingKeyName(song.originalKey, song.keyShift ?? 0) ?? song.originalKey ?? '';
            return (
              <PressableScale
                key={`${song.id}-${index}`}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => {
                  onSelectSong(song.id, index);
                  onClose();
                }}
                accessibilityLabel={`Song ${index + 1}, ${song.title}`}>
                <Text style={[styles.num, on && styles.numOn]}>{index + 1}</Text>
                <View style={styles.rowBody}>
                  <Text style={[styles.songTitle, on && styles.songTitleOn]} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.songMeta} numberOfLines={1}>
                    {[song.artist, key].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  const dim =
    t.id === 'ultra-light' ? 'rgba(10,10,12,0.28)' : t.id === 'stage' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)';
  return {
    root: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 },
    dim: {
      position: 'absolute' as const,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: dim,
    },
    panel: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      maxHeight: '72%' as unknown as number,
      backgroundColor: t.bg,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    panelHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    panelHeaderText: { flex: 1, minWidth: 0 },
    setTitle: {
      color: t.text,
      fontSize: t.type.title.fontSize,
      lineHeight: t.type.title.lineHeight,
      fontWeight: t.type.title.fontWeight,
    },
    setDate: {
      color: t.muted,
      marginTop: 2,
      fontSize: t.type.meta.fontSize,
      lineHeight: t.type.meta.lineHeight,
      fontWeight: t.type.meta.fontWeight,
    },
    closeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
    },
    closeText: { color: t.text, fontWeight: '600' as const, fontSize: 13 },
    list: { maxHeight: 420 },
    listContent: { paddingVertical: 8, paddingHorizontal: 8, paddingBottom: 16 },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: t.radius.md,
    },
    rowOn: { backgroundColor: t.panel },
    num: {
      width: 28,
      textAlign: 'center' as const,
      color: t.muted,
      fontWeight: '700' as const,
      fontSize: 15,
    },
    numOn: { color: t.accent },
    rowBody: { flex: 1, minWidth: 0 },
    songTitle: {
      color: t.text,
      fontWeight: t.type.body.fontWeight,
      fontSize: t.type.body.fontSize,
      lineHeight: t.type.body.lineHeight,
    },
    songTitleOn: { color: t.accent, fontWeight: '700' as const },
    songMeta: {
      color: t.muted,
      marginTop: 2,
      fontSize: t.type.meta.fontSize,
      lineHeight: t.type.meta.lineHeight,
      fontWeight: t.type.meta.fontWeight,
    },
  };
}
