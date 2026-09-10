import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { fingerprintContent, parseChordPro } from '@setlist-ultra/core';
import { BrandButton } from '@/src/components/BrandButton';
import { SearchField } from '@/src/components/SearchField';
import { BrandDialog } from '@/src/components/BrandDialog';
import { UgImportSheet } from '@/src/components/UgImportSheet';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useUgOnlineSearch } from '@/src/hooks/useUgOnlineSearch';
import {
  createBlankSong,
  importAnyChartFile,
  insertLibrarySong,
  saveSongFromUg,
} from '@/src/lib/repository';
import { importUgTab, type UgSongGroup } from '@/src/lib/ug-api';
import { config } from '@/src/lib/config';
import { pickBinaryFile, pickImage } from '@/src/lib/files';
import { lookupRemoteChart } from '@/src/lib/hosted';
import { openSongInLive } from '@/src/lib/openSongInLive';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function ImportScreen() {
  const router = useRouter();
  const { refresh } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [tab, setTab] = useState<'online' | 'paste' | 'file'>('online');
  const [query, setQuery] = useState('');
  const [importGroup, setImportGroup] = useState<UgSongGroup | null>(null);
  const [directUrl, setDirectUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [title, setTitle] = useState('Untitled');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);

  // Same online engine as Songs tab search (debounce, group/rank, load-more, hide Official).
  const online = useUgOnlineSearch(query, { enabled: tab === 'online', clearWhenDisabled: false });

  const afterImport = async (songId?: string) => {
    await refresh();
    if (songId) await openSongInLive(router, songId, 'replace');
    else router.back();
  };

  const submitSearch = () => {
    Keyboard.dismiss();
    online.runSearch();
  };

  const importUrl = async (url: string) => {
    setBusy(true);
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
      setDialog({ title: 'Import failed', body: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setBusy(false);
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
      setDialog({ title: 'Imported', body: `${result.songs} songs, ${result.sets} sets` });
      router.back();
    } catch (error) {
      setDialog({ title: 'Import failed', body: error instanceof Error ? error.message : 'Unknown error' });
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
      setDialog({ title: 'Paste failed', body: error instanceof Error ? error.message : 'Unknown error' });
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
      setDialog({ title: 'Scan failed', body: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['online', 'file', 'paste'] as const).map((id) => (
          <Pressable key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
            <Text style={styles.tabText}>{id === 'file' ? 'File / SBP' : id === 'online' ? 'Search online' : 'Paste'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'file' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      ) : null}

      {tab === 'online' ? (
        <View style={styles.online}>
          <Text style={styles.label}>Search Ultimate Guitar</Text>
          <View style={styles.row}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Song title or artist"
              style={{ flex: 1, marginBottom: 0 }}
              onSubmitEditing={submitSearch}
            />
            <Pressable style={styles.searchButton} onPress={submitSearch} disabled={online.status === 'searching'}>
              {online.status === 'searching' ? (
                <ActivityIndicator color={theme.accentText} />
              ) : (
                <Text style={styles.buttonText}>Go</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.onlineBody}>
            <FlatList
              data={online.groups}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              onEndReachedThreshold={0.4}
              onEndReached={() => online.loadMore()}
              ListEmptyComponent={
                online.status === 'searching' ? (
                  <ActivityIndicator style={{ marginVertical: 16 }} color={theme.accent} />
                ) : online.status === 'error' ? (
                  <Text style={styles.error}>
                    {online.error || 'Search failed'}
                    {`\n\nProxy: ${config.ugProxyUrl}`}
                  </Text>
                ) : online.status === 'empty' ? (
                  <Text style={styles.label}>Nothing found. Try another search or paste a UG tab URL below.</Text>
                ) : (
                  <Text style={styles.label}>Search a title, then pick a song and a version.</Text>
                )
              }
              ListFooterComponent={
                online.loadingMore ? (
                  <ActivityIndicator style={{ marginVertical: 16 }} color={theme.accent} />
                ) : online.nextPage && query.trim() ? (
                  <Pressable style={styles.loadMore} onPress={() => online.loadMore()}>
                    <Text style={styles.ghostText}>Load more</Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => {
                const rating = item.rating != null ? `${item.rating.toFixed(1)}★` : null;
                return (
                  <Pressable style={styles.result} onPress={() => setImportGroup(item)}>
                    <Text style={styles.resultTitle}>{item.songName}</Text>
                    <Text style={styles.resultUrl}>
                      {item.artistName || 'Unknown artist'}
                      {` · ${item.versions.length} version${item.versions.length === 1 ? '' : 's'}`}
                      {rating ? ` · ${rating}` : ''}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          <Text style={styles.label}>Or paste tab URL</Text>
          <TextInput
            value={directUrl}
            onChangeText={setDirectUrl}
            placeholder="https://tabs.ultimate-guitar.com/tab/..."
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (directUrl.trim()) void importUrl(directUrl.trim());
            }}
            style={styles.input}
          />
          <BrandButton label="Import URL" onPress={() => void importUrl(directUrl.trim())} disabled={!directUrl.trim()} busy={busy} />
        </View>
      ) : null}

      {tab === 'paste' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      ) : null}

      <UgImportSheet
        group={importGroup}
        onClose={() => setImportGroup(null)}
        onImported={(songId) => {
          void (async () => {
            await refresh();
            await openSongInLive(router, songId, 'replace');
          })();
        }}
      />

      <BrandDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        body={dialog?.body}
        onClose={() => setDialog(null)}
        actions={[{ label: 'OK', onPress: () => setDialog(null) }]}
      />
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    content: { paddingBottom: 40 },
    online: { flex: 1 },
    onlineBody: { flex: 1, minHeight: 180, marginBottom: 12 },
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
    error: { color: t.danger, marginBottom: 8 },
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
    loadMore: { alignItems: 'center' as const, paddingVertical: 16 },
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
