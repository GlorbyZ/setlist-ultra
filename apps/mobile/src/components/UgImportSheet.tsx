import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { fingerprintContent, normalizeUgTab, type UgTabResponse } from '@setlist-ultra/core';
import { BrandButton } from '@/src/components/BrandButton';
import { SongViewer } from '@/src/components/SongViewer';
import { insertLibrarySong, saveSongFromUg } from '@/src/lib/repository';
import { importUgTab, type UgSearchHit, type UgSongGroup } from '@/src/lib/ug-api';
import { lookupRemoteChart } from '@/src/lib/hosted';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  group: UgSongGroup | null;
  onClose: () => void;
  onImported: (songId: string) => void;
};

export function UgImportSheet({ group, onClose, onImported }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [previewHit, setPreviewHit] = useState<UgSearchHit | null>(null);
  const [previewTab, setPreviewTab] = useState<UgTabResponse | null>(null);
  const [previewShift, setPreviewShift] = useState(0);
  const [previewCapo, setPreviewCapo] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewDoc = useMemo(
    () => (previewTab && previewHit ? normalizeUgTab(previewTab, previewHit.url) : null),
    [previewTab, previewHit],
  );

  const close = () => {
    setPreviewHit(null);
    setPreviewTab(null);
    setError(null);
    onClose();
  };

  const openVersion = async (hit: UgSearchHit) => {
    setLoadingPreview(true);
    setPreviewHit(hit);
    setPreviewShift(0);
    setError(null);
    try {
      const tabData = await importUgTab(hit.url);
      setPreviewTab(tabData);
      const capo = Number.parseInt(tabData.tab.capo ?? '0', 10);
      setPreviewCapo(Number.isFinite(capo) ? capo : 0);
    } catch (err) {
      setPreviewHit(null);
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoadingPreview(false);
    }
  };

  const importUrl = async (url: string) => {
    setBusy(true);
    setError(null);
    try {
      const remote = await lookupRemoteChart(fingerprintContent(url), 'ultimate_guitar', url);
      if (remote?.chordpro && !previewShift) {
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
        close();
        onImported(songId);
        return;
      }
      const tabData = previewTab && previewHit?.url === url ? previewTab : await importUgTab(url);
      const songId = await saveSongFromUg(tabData, url, { transpose: previewShift, capo: previewCapo });
      close();
      onImported(songId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(group)} animationType="slide" onRequestClose={close}>
      <View style={[styles.shell, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {!group ? null : previewHit && previewDoc ? (
          <>
            <Pressable onPress={() => { setPreviewHit(null); setPreviewTab(null); }}>
              <Text style={styles.link}>← Versions</Text>
            </Pressable>
            <Text style={styles.title}>{previewDoc.meta.title}</Text>
            <Text style={styles.meta}>
              {previewDoc.meta.artist}
              {previewHit.type ? ` · ${previewHit.type}` : ''}
            </Text>
            <View style={styles.tools}>
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
            <View style={styles.stage}>
              <SongViewer document={previewDoc.document} transpose={previewShift} capo={previewCapo} fontSize={16} />
            </View>
            <BrandButton label="Import" busy={busy} onPress={() => void importUrl(previewHit.url)} />
          </>
        ) : (
          <>
            <Pressable onPress={close}>
              <Text style={styles.link}>← Songs</Text>
            </Pressable>
            <Text style={styles.title}>{group.songName}</Text>
            <Text style={styles.meta}>
              {group.artistName || 'Unknown artist'} · {group.versions.length} version
              {group.versions.length === 1 ? '' : 's'}
            </Text>
            {loadingPreview ? <ActivityIndicator style={{ marginVertical: 12 }} color={theme.accent} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <FlatList
              data={group.versions}
              keyExtractor={(item) => item.url}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => void openVersion(item)}>
                  <Text style={styles.rowTitle}>{item.type || 'Version'}</Text>
                  <Text style={styles.meta}>
                    {[item.rating != null ? `${item.rating.toFixed(1)}★` : null, item.key].filter(Boolean).join(' · ') ||
                      'Tap to preview'}
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}
        {previewHit && error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

function makeStyles(t: AppTheme) {
  return {
    shell: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 16 },
    link: { color: t.accent, fontWeight: '700' as const, marginBottom: 8 },
    title: { color: t.text, fontSize: 20, fontWeight: '800' as const },
    meta: { color: t.muted, marginTop: 4, marginBottom: 12 },
    error: { color: t.danger, marginBottom: 8 },
    tools: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 },
    tool: {
      backgroundColor: t.panel,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    toolText: { color: t.text, fontWeight: '600' as const, fontSize: 13 },
    stage: { flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: t.radius.md, overflow: 'hidden' as const, marginBottom: 12 },
    row: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    rowTitle: { color: t.text, fontWeight: '700' as const },
  };
}
