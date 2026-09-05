import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { fingerprintContent, parseChordPro } from '@setlist-ultra/core';
import { useLibrary } from '@/src/providers/LibraryProvider';
import {
  createBlankSong,
  importSbpArchive,
  insertLibrarySong,
  saveSongFromUg,
} from '@/src/lib/repository';
import { importUgTab, searchUgTabs, type UgSearchResult } from '@/src/lib/ug-api';
import { config } from '@/src/lib/config';
import { pickBinaryFile, pickImage } from '@/src/lib/files';
import { lookupRemoteChart } from '@/src/lib/hosted';
import { colors } from '@/src/theme';

export default function ImportScreen() {
  const router = useRouter();
  const { refresh } = useLibrary();
  const [tab, setTab] = useState<'online' | 'paste' | 'file'>('file');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UgSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [title, setTitle] = useState('Untitled');
  const [busy, setBusy] = useState(false);

  const afterImport = async (songId?: string) => {
    await refresh();
    if (songId) router.replace(`/song/${songId}`);
    else router.back();
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const rows = await searchUgTabs(query.trim());
      setResults(rows);
      if (!rows.length) Alert.alert('No results', 'Try another search or paste a UG tab URL below.');
    } catch (error) {
      Alert.alert('Search failed', `${error instanceof Error ? error.message : 'Unknown error'}\n\nProxy: ${config.ugProxyUrl}`);
    } finally {
      setSearching(false);
    }
  };

  const importUrl = async (url: string) => {
    setImportingUrl(url);
    try {
      const remote = await lookupRemoteChart(fingerprintContent(url), 'ultimate_guitar', url);
      if (remote?.chordpro) {
        const songId = await insertLibrarySong({
          title: remote.title || 'Imported chart',
          artist: remote.artist || '',
          originalKey: remote.original_key ?? undefined,
          chordpro: remote.chordpro,
          sourceProvider: 'ultimate_guitar',
          sourceUrl: url,
          sourceExternalId: url,
          importSource: 'web:ultimate-guitar.com',
        });
        await afterImport(songId);
        return;
      }
      const tabData = await importUgTab(url);
      const songId = await saveSongFromUg(tabData, url);
      await afterImport(songId);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setImportingUrl(null);
    }
  };

  const importFile = async () => {
    setBusy(true);
    try {
      const picked = await pickBinaryFile();
      if (!picked) return;
      const name = picked.name.toLowerCase();
      if (name.endsWith('.sbp') || name.endsWith('.sbpbackup') || name.endsWith('.zip')) {
        const result = await importSbpArchive(picked.bytes, picked.name);
        await refresh();
        Alert.alert('Imported', `${result.songs} songs, ${result.sets} sets`);
        router.back();
        return;
      }
      const text = new TextDecoder().decode(picked.bytes);
      const parsed = parseChordPro(text);
      const songId = await insertLibrarySong({
        title: parsed.meta.title || picked.name.replace(/\.[^.]+$/, ''),
        artist: parsed.meta.artist || '',
        originalKey: parsed.meta.key,
        capo: parsed.meta.capo,
        tempo: parsed.meta.tempo,
        chordpro: text,
        document: parsed.document,
        importSource: 'editor',
        sourceProvider: 'chordpro',
      });
      await afterImport(songId);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const importPaste = async () => {
    setBusy(true);
    try {
      const parsed = parseChordPro(paste);
      const songId = await insertLibrarySong({
        title: parsed.meta.title || title,
        artist: parsed.meta.artist || '',
        originalKey: parsed.meta.key,
        capo: parsed.meta.capo,
        chordpro: paste,
        document: parsed.document,
        importSource: 'editor',
        sourceProvider: 'chordpro',
      });
      await afterImport(songId);
    } catch (error) {
      Alert.alert('Paste failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    const id = await createBlankSong(title || 'Untitled');
    await afterImport(id);
  };

  const scanPaper = async () => {
    setBusy(true);
    try {
      const image = await pickImage();
      if (!image) return;
      const id = await insertLibrarySong({
        title: image.name.replace(/\.[^.]+$/, ''),
        artist: '',
        chordpro: `{c: Scanned}\n[Transcribe this chart in the editor]\n`,
        contentKind: 'image',
        mediaUri: image.uri,
        importSource: 'camera',
        sourceProvider: 'manual',
      });
      await afterImport(id);
    } catch (error) {
      Alert.alert('Scan failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabs}>
        {(['file', 'online', 'paste'] as const).map((id) => (
          <Pressable key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
            <Text style={styles.tabText}>{id === 'file' ? 'File / SBP' : id === 'online' ? 'Search online' : 'Paste'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'file' ? (
        <View>
          <Text style={styles.label}>.sbp / .sbpbackup / ChordPro</Text>
          <Pressable style={styles.button} onPress={() => void importFile()} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Choose file</Text>}
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => void createNew()}>
            <Text style={styles.ghostText}>Create empty song</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => void scanPaper()}>
            <Text style={styles.ghostText}>Camera / image scan</Text>
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="New song title"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
        </View>
      ) : null}

      {tab === 'online' ? (
        <View>
          <Text style={styles.label}>Search Ultimate Guitar</Text>
          <View style={styles.row}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Song title or artist"
              placeholderTextColor={colors.faint}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              onSubmitEditing={runSearch}
            />
            <Pressable style={styles.searchButton} onPress={runSearch} disabled={searching}>
              {searching ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Go</Text>}
            </Pressable>
          </View>
          <FlatList
            data={results}
            keyExtractor={(item) => item.url}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable style={styles.result} disabled={importingUrl === item.url} onPress={() => importUrl(item.url)}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultUrl}>{item.url}</Text>
                {importingUrl === item.url ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
              </Pressable>
            )}
          />
          <Text style={styles.label}>Or paste tab URL</Text>
          <TextInput
            value={directUrl}
            onChangeText={setDirectUrl}
            placeholder="https://tabs.ultimate-guitar.com/tab/..."
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable style={styles.button} disabled={!directUrl.trim()} onPress={() => importUrl(directUrl.trim())}>
            <Text style={styles.buttonText}>Import URL</Text>
          </Pressable>
        </View>
      ) : null}

      {tab === 'paste' ? (
        <View>
          <Text style={styles.label}>ChordPro</Text>
          <TextInput
            value={paste}
            onChangeText={setPaste}
            placeholder="{c: Verse}&#10;[G]Hello [C]world"
            placeholderTextColor={colors.faint}
            multiline
            style={[styles.input, styles.paste]}
          />
          <Pressable style={styles.button} disabled={!paste.trim() || busy} onPress={() => void importPaste()}>
            <Text style={styles.buttonText}>Save to library</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, backgroundColor: colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tabOn: { backgroundColor: colors.accent },
  tabText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  label: { color: colors.muted, marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    backgroundColor: colors.border,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  paste: { minHeight: 220, textAlignVertical: 'top', fontFamily: 'SpaceMono' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: { color: colors.accentText, fontWeight: '700' },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  ghost: { paddingVertical: 10, alignItems: 'center' },
  ghostText: { color: colors.accent, fontWeight: '700' },
  result: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: { color: colors.text, fontWeight: '700' },
  resultUrl: { color: colors.faint, marginTop: 4, fontSize: 12 },
});
