import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { LibrarySwitcher } from '@/src/components/LibrarySwitcher';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { formatDate } from '@/src/lib/format';
import { createSetlist, setlistDuration } from '@/src/lib/repository';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function SetsScreen() {
  const { setlists, loading, error, refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true });
    }, [refresh]),
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createSetlist(`Set ${setlists.length + 1}`);
      await refresh();
      router.push(`/setlist/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LibrarySwitcher />
      <BrandButton label="+ New set" onPress={() => void handleCreate()} busy={creating} />

      {error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Could not load sets</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <BrandButton label="Retry" onPress={() => void refresh()} />
        </View>
      ) : loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
      ) : (
        <FlatList
          data={setlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No sets.</Text>
              <Text style={styles.emptyBody}>Tap + New set.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/setlist/${item.id}`)}
              onLayout={() => {
                if (durations[item.id] != null) return;
                void setlistDuration(item.id).then((sec) =>
                  setDurations((prev) => ({ ...prev, [item.id]: sec })),
                );
              }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {formatDate(item.eventDate)}
                {item.pinned ? ' · Pinned' : ''}
                {durations[item.id] != null ? ` · ${Math.round(durations[item.id] / 60)} min` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    list: { paddingBottom: 40 },
    row: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    title: { color: t.text, fontSize: 18, fontWeight: '700' as const },
    meta: { color: t.muted, marginTop: 4 },
    empty: { padding: 32, alignItems: 'center' as const },
    emptyTitle: { color: t.text, fontSize: 20, fontWeight: '700' as const },
    emptyBody: { color: t.muted, marginTop: 8, textAlign: 'center' as const },
  };
}
