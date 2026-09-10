import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandDialog } from '@/src/components/BrandDialog';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { formatDate } from '@/src/lib/format';
import { createSetlist, deleteSetlist, setlistDurations } from '@/src/lib/repository';
import { pressedStyle } from '@/src/motion';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function SetsScreen() {
  const { setlists, loading, error, refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [confirmBulk, setConfirmBulk] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Sets-only silent refresh — avoid reloading every song chart on tab focus.
      void refresh({ silent: true, setlistsOnly: true });
    }, [refresh]),
  );

  useEffect(() => {
    let cancelled = false;
    const ids = setlists.map((s) => s.id);
    if (!ids.length) {
      setDurations({});
      return;
    }
    void setlistDurations(ids).then((map) => {
      if (!cancelled) setDurations(map);
    });
    return () => {
      cancelled = true;
    };
  }, [setlists]);

  const selectedIds = Object.keys(picked).filter((id) => picked[id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createSetlist(`Set ${setlists.length + 1}`);
      await refresh({ setlistsOnly: true });
      router.push(`/setlist/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh({ setlistsOnly: true });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LibrarySwitcher />
      <View style={styles.toolbar}>
        <View style={styles.toolbarFlex}>
          <BrandButton label="+ New set" onPress={() => void handleCreate()} busy={creating} />
        </View>
        <View style={styles.toolbarFlex}>
          <BrandButton
            label={managing ? 'Done' : 'Manage'}
            onPress={() => {
              setManaging((v) => !v);
              setPicked({});
            }}
          />
        </View>
      </View>

      {managing ? (
        <BrandButton
          label={selectedIds.length ? `Delete ${selectedIds.length}` : 'Delete selected'}
          disabled={!selectedIds.length}
          onPress={() => setConfirmBulk(true)}
        />
      ) : null}

      {error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Could not load sets</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <BrandButton label="Retry" onPress={() => void refresh({ setlistsOnly: true })} />
        </View>
      ) : loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={setlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No sets.</Text>
              <Text style={styles.emptyBody}>Tap + New set.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const on = managing && picked[item.id];
            return (
              <Pressable
                unstable_pressDelay={0}
                style={pressedStyle([styles.row, on && styles.rowOn])}
                onPress={() => {
                  if (managing) {
                    setPicked((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                    return;
                  }
                  router.push(`/setlist/${item.id}`);
                }}>
                <Text style={styles.title}>
                  {managing ? (on ? '✓ ' : '○ ') : ''}
                  {item.title}
                </Text>
                <Text style={styles.meta}>
                  {formatDate(item.eventDate)}
                  {item.pinned ? ' · Pinned' : ''}
                  {durations[item.id] != null ? ` · ${Math.round(durations[item.id] / 60)} min` : ''}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <BrandDialog
        visible={confirmBulk}
        title="Delete selected sets?"
        body={`Remove ${selectedIds.length} set(s). Songs stay in your library.`}
        onClose={() => setConfirmBulk(false)}
        actions={[
          {
            label: 'Delete',
            danger: true,
            onPress: () => {
              const ids = selectedIds.slice();
              setConfirmBulk(false);
              void (async () => {
                for (const id of ids) await deleteSetlist(id);
                setManaging(false);
                setPicked({});
                await refresh({ setlistsOnly: true });
              })();
            },
          },
          { label: 'Cancel', onPress: () => setConfirmBulk(false) },
        ]}
      />
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg, padding: 16, gap: 10 },
    toolbar: { flexDirection: 'row' as const, gap: 8 },
    toolbarFlex: { flex: 1 },
    loadingBox: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: t.bg, paddingTop: 40 },
    list: { paddingBottom: 40 },
    row: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    rowOn: { borderColor: t.accent },
    title: { color: t.text, fontSize: t.type.title.fontSize, lineHeight: t.type.title.lineHeight, fontWeight: t.type.title.fontWeight },
    meta: { color: t.muted, marginTop: 4, fontSize: t.type.meta.fontSize, lineHeight: t.type.meta.lineHeight, fontWeight: t.type.meta.fontWeight },
    empty: { padding: 32, alignItems: 'center' as const },
    emptyTitle: { color: t.text, fontSize: t.type.title.fontSize, lineHeight: t.type.title.lineHeight, fontWeight: t.type.title.fontWeight },
    emptyBody: { color: t.muted, marginTop: 8, textAlign: 'center' as const, fontSize: t.type.body.fontSize, lineHeight: t.type.body.lineHeight, fontWeight: t.type.body.fontWeight },
  };
}
