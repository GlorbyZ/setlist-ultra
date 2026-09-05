import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { fingerprintContent, parseChordPro } from '@setlist-ultra/core';
import { BrandButton } from '@/src/components/BrandButton';
import { useLibrary } from '@/src/providers/LibraryProvider';
import {
  createBlankSong,
  importAnyChartFile,
  insertLibrarySong,
  saveSongFromUg,
} from '@/src/lib/repository';
import { importUgTab, searchUgTabs, type UgSearchResult } from '@/src/lib/ug-api';
import { config } from '@/src/lib/config';
import { pickBinaryFile, pickImage } from '@/src/lib/files';
import { lookupRemoteChart } from '@/src/lib/hosted';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function ImportScreen() {
  const router = useRouter();
  const { refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
      const result = await importAnyChartFile(picked.bytes, picked.name);
      await refresh();
      if (result.kind === 'song' && result.songId) {
        await afterImport(result.songId);
        return;
      }
      Alert.alert('Imported', `${result.songs} songs, ${result.sets} sets`);
      router.back();
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
          <BrandButton label="Choose file" onPress={() => void importFile()} busy={busy} />
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
            placeholderTextColor={theme.faint}
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
              placeholderTextColor={theme.faint}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              onSubmitEditing={() => void runSearch()}
            />
            <Pressable style={styles.searchButton} onPress={() => void runSearch()} disabled={searching}>
              {searching ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.buttonText}>Go</Text>}
            </Pressable>
          </View>
          <FlatList
            data={results}
            keyExtractor={(item) => item.url}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable style={styles.result} disabled={importingUrl === item.url} onPress={() => void importUrl(item.url)}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultUrl}>{item.url}</Text>
                {importingUrl === item.url ? <ActivityIndicator style={{ marginTop: 8 }} color={theme.accent} /> : null}
              </Pressable>
            )}
          />
          <Text style={styles.label}>Or paste tab URL</Text>
          <TextInput
            value={directUrl}
            onChangeText={setDirectUrl}
            placeholder="https://tabs.ultimate-guitar.com/tab/..."
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            style={styles.input}
          />
          <BrandButton label="Import URL" onPress={() => void importUrl(directUrl.trim())} disabled={!directUrl.trim()} />
        </View>
      ) : null}

      {tab === 'paste' ? (
        <View>
          <Text style={styles.label}>ChordPro</Text>
          <TextInput
            value={paste}
            onChangeText={setPaste}
            placeholder="{c: Verse}&#10;[G]Hello [C]world"
            placeholderTextColor={theme.faint}
            multiline
            style={[styles.input, styles.paste]}
          />
          <BrandButton label="Save to library" onPress={() => void importPaste()} disabled={!paste.trim()} busy={busy} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 40 },
    tabs: { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
    tab: {
      flex: 1,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      paddingVertical: 10,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: t.border,
    },
    tabOn: { borderColor: t.accent, backgroundColor: t.panel },
    tabText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
    label: { color: t.muted, marginBottom: 8, fontWeight: '600' as const },
    row: { flexDirection: 'row' as const, gap: 8, marginBottom: 12 },
    input: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    paste: { minHeight: 220, textAlignVertical: 'top' as const, fontFamily: 'SpaceMono' },
    buttonText: { color: t.accentText, fontWeight: '700' as const },
    searchButton: {
      backgroundColor: t.accent,
      borderRadius: t.radius.md,
      paddingHorizontal: 16,
      justifyContent: 'center' as const,
    },
    ghost: { paddingVertical: 10, alignItems: 'center' as const },
    ghostText: { color: t.accent, fontWeight: '700' as const },
    result: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    resultTitle: { color: t.text, fontWeight: '700' as const },
    resultUrl: { color: t.faint, marginTop: 4, fontSize: 12 },
  };
}
