import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { useLibrary } from '@/src/providers/LibraryProvider';
import { saveSongFromUg } from '@/src/lib/repository';
import { importUgTab, searchUgTabs, type UgSearchResult } from '@/src/lib/ug-api';
import { config } from '@/src/lib/config';

export default function ImportScreen() {
  const router = useRouter();
  const { refresh } = useLibrary();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UgSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState('');

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const rows = await searchUgTabs(query.trim());
      setResults(rows);
      if (!rows.length) {
        Alert.alert('No results', 'Try another search or paste a UG tab URL below.');
      }
    } catch (error) {
      Alert.alert(
        'Search failed',
        `${error instanceof Error ? error.message : 'Unknown error'}\n\nProxy: ${config.ugProxyUrl}`,
      );
    } finally {
      setSearching(false);
    }
  };

  const importUrl = async (url: string) => {
    setImportingUrl(url);
    try {
      const tab = await importUgTab(url);
      const songId = await saveSongFromUg(tab, url);
      await refresh();
      router.replace(`/song/${songId}`);
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setImportingUrl(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Search Ultimate Guitar</Text>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Song title or artist"
          placeholderTextColor="#64748b"
          style={styles.input}
          onSubmitEditing={runSearch}
        />
        <Pressable style={styles.searchButton} onPress={runSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.searchText}>Search</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.url}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.result}
            disabled={importingUrl === item.url}
            onPress={() => importUrl(item.url)}>
            <Text style={styles.resultTitle}>{item.title}</Text>
            <Text style={styles.resultUrl}>{item.url}</Text>
            {importingUrl === item.url ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
          </Pressable>
        )}
      />

      <View style={styles.directBox}>
        <Text style={styles.label}>Or paste tab URL</Text>
        <TextInput
          value={directUrl}
          onChangeText={setDirectUrl}
          placeholder="https://tabs.ultimate-guitar.com/tab/..."
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable
          style={styles.importButton}
          disabled={!directUrl.trim() || importingUrl === directUrl}
          onPress={() => importUrl(directUrl.trim())}>
          {importingUrl === directUrl ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.searchText}>Import URL</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 16 },
  label: { color: '#94a3b8', marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchText: { color: '#0f172a', fontWeight: '700' },
  list: { paddingBottom: 16 },
  result: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resultTitle: { color: '#f8fafc', fontWeight: '700' },
  resultUrl: { color: '#64748b', marginTop: 4, fontSize: 12 },
  directBox: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 16 },
  importButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
});
