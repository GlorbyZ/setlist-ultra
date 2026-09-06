import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { assertUgTabMatchesRequest, fingerprintContent, normalizeUgTab, parseChordPro, type UgTabResponse } from '@setlist-ultra/core';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandDialog } from '@/src/components/BrandDialog';
import { SongViewer } from '@/src/components/SongViewer';
import { useLibrary } from '@/src/providers/LibraryProvider';
import {
  createBlankSong,
  importAnyChartFile,
  insertLibrarySong,
  saveSongFromUg,
} from '@/src/lib/repository';
import {
  importUgTab,
  searchUgTabs,
  type UgSearchHit,
  type UgSongGroup,
} from '@/src/lib/ug-api';
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
  const [groups, setGroups] = useState<UgSongGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<UgSongGroup | null>(null);
  const [previewHit, setPreviewHit] = useState<UgSearchHit | null>(null);
  const [previewTab, setPreviewTab] = useState<UgTabResponse | null>(null);
  const [previewShift, setPreviewShift] = useState(0);
  const [previewCapo, setPreviewCapo] = useState(0);
  const [searching, setSearching] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [paste, setPaste] = useState('');
  const [title, setTitle] = useState('Untitled');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);

  const previewDoc = useMemo(
    () => (previewTab && previewHit ? normalizeUgTab(previewTab, previewHit.url) : null),
    [previewTab, previewHit],
  );

  const afterImport = async (songId?: string) => {
    await refresh();
    if (songId) router.replace(`/song/${songId}`);
    else router.back();
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setSearching(true);
    setSelectedGroup(null);
    setPreviewHit(null);
    setPreviewTab(null);
    try {
      const page = await searchUgTabs(q);
      setGroups(page.groups);
      if (!page.groups.length) setDialog({ title: 'No results', body: 'Try another search or paste a UG tab URL below.' });
    } catch (error) {
      setDialog({
        title: 'Search failed',
        body: `${error instanceof Error ? error.message : 'Unknown error'}\n\nProxy: ${config.ugProxyUrl}`,
      });
    } finally {
      setSearching(false);
    }
  };

  const openVersion = async (hit: UgSearchHit) => {
    setLoadingPreview(true);
    setPreviewHit(null);
    setPreviewTab(null);
    setPreviewShift(0);
    try {
      const tabData = await importUgTab(hit.url);
      assertUgTabMatchesRequest(tabData, hit.url, {
        songName: hit.songName || selectedGroup?.songName,
        artistName: hit.artistName || selectedGroup?.artistName,
      });
      setPreviewHit(hit);
      setPreviewTab(tabData);
      const capo = Number.parseInt(tabData.tab.capo ?? '0', 10);
      setPreviewCapo(Number.isFinite(capo) ? capo : 0);
    } catch (error) {
      setPreviewHit(null);
      setPreviewTab(null);
      setDialog({
        title: 'Preview failed',
        body: error instanceof Error ? error.message : 'Could not open this version.',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const importUrl = async (url: string, transpose = 0, capo?: number) => {
    setBusy(true);
    try {
      const remote = await lookupRemoteChart(fingerprintContent(url), 'ultimate_guitar', url);
      if (remote?.chordpro && !transpose) {
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
      const tabData = previewTab && previewHit?.url === url ? previewTab : await importUgTab(url);
      const songId = await saveSongFromUg(tabData, url, { transpose, capo });
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
        {(['file', 'online', 'paste'] as const).map((id) => (
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
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Song title or artist"
              placeholderTextColor={theme.faint}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              returnKeyType="search"
              blurOnSubmit
              autoCorrect={false}
              autoCapitalize="none"
              enablesReturnKeyAutomatically
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => void runSearch()}
            />
            <Pressable style={styles.searchButton} onPress={() => void runSearch()} disabled={searching}>
              {searching ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.buttonText}>Go</Text>}
            </Pressable>
          </View>

          <View style={styles.onlineBody}>
            {previewHit && previewDoc ? (
              <View style={styles.previewCard}>
                <Pressable onPress={() => { setPreviewHit(null); setPreviewTab(null); }}>
                  <Text style={styles.ghostText}>← Versions</Text>
                </Pressable>
                <Text style={styles.resultTitle}>{previewDoc.meta.title}</Text>
                <Text style={styles.resultUrl}>
                  {previewDoc.meta.artist}
                  {previewHit.type ? ` · ${previewHit.type}` : ''}
                  {previewHit.key ? ` · ${previewHit.key}` : ''}
                </Text>
                <View style={styles.previewTools}>
                  <Pressable style={styles.tool} onPress={() => setPreviewShift((v) => v - 1)}>
                    <Text style={styles.toolText}>Key −</Text>
                  </Pressable>
                  <Pressable style={styles.tool} onPress={() => setPreviewShift((v) => v + 1)}>
                    <Text style={styles.toolText}>Key +</Text>
                  </Pressable>
                  <Pressable style={styles.tool} onPress={() => setPreviewCapo((v) => Math.max(0, v - 1))}>
                    <Text style={styles.toolText}>Capo −</Text>
                  </Pressable>
                  <Pressable style={styles.tool} onPress={() => setPreviewCapo((v) => Math.min(12, v + 1))}>
                    <Text style={styles.toolText}>Capo +</Text>
                  </Pressable>
                </View>
                <Text style={styles.label}>
                  Shift {previewShift > 0 ? `+${previewShift}` : previewShift} · Capo {previewCapo}
                </Text>
                <View style={styles.previewStage}>
                  <SongViewer document={previewDoc.document} transpose={previewShift} capo={previewCapo} fontSize={16} />
                </View>
                <BrandButton
                  label="Import"
                  busy={busy}
                  onPress={() => void importUrl(previewHit.url, previewShift, previewCapo)}
                />
              </View>
            ) : selectedGroup ? (
              <FlatList
                data={selectedGroup.versions}
                keyExtractor={(item) => item.url}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View style={{ marginBottom: 8 }}>
                    <Pressable onPress={() => setSelectedGroup(null)}>
                      <Text style={styles.ghostText}>← Songs</Text>
                    </Pressable>
                    <Text style={styles.resultTitle}>{selectedGroup.songName}</Text>
                    <Text style={styles.resultUrl}>
                      {selectedGroup.artistName || 'Unknown artist'} · {selectedGroup.versions.length} version
                      {selectedGroup.versions.length === 1 ? '' : 's'}
                    </Text>
                    {loadingPreview ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.accent} /> : null}
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable style={styles.result} onPress={() => void openVersion(item)}>
                    <Text style={styles.resultTitle}>{item.type || 'Version'}</Text>
                    <Text style={styles.resultUrl}>
                      {[item.rating != null ? `${item.rating.toFixed(1)}★` : null, item.key].filter(Boolean).join(' · ') ||
                        'Tap to preview'}
                    </Text>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  searching ? null : (
                    <Text style={styles.label}>Search a title, then pick a song and a version.</Text>
                  )
                }
                renderItem={({ item }) => (
                  <Pressable style={styles.result} onPress={() => setSelectedGroup(item)}>
                    <Text style={styles.resultTitle}>{item.songName}</Text>
                    <Text style={styles.resultUrl}>
                      {item.artistName || 'Unknown artist'} · {item.versions.length} version
                      {item.versions.length === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                )}
              />
            )}
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
    previewCard: { flex: 1, marginBottom: 8 },
    previewTools: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginVertical: 12 },
    tool: {
      backgroundColor: t.panel,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    toolText: { color: t.text, fontWeight: '600' as const, fontSize: 13 },
    previewStage: { flex: 1, minHeight: 180, borderWidth: 1, borderColor: t.border, borderRadius: t.radius.md, overflow: 'hidden' as const, marginBottom: 12 },
  };
}
