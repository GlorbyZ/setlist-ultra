import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef, useState } from 'react';

import { ImportOverlay } from '@/src/components/ImportOverlay';
import { filenameFromUri } from '@/src/lib/format';
import { readImportBytes } from '@/src/lib/files';
import { runChartImport } from '@/src/lib/importSession';
import { openSongInLive } from '@/src/lib/openSongInLive';
import { saveSongFromUg, type ImportProgressEvent } from '@/src/lib/repository';
import { importUgTab } from '@/src/lib/ug-api';
import { useLibrary } from '@/src/providers/LibraryProvider';

const CHART_EXT = /\.(sbpbackup|sbp|cho|chopro|crd|onsong|pro|txt|zip)$/i;

function looksLikeChartUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.startsWith('setlistultra://')) return false;
  return (
    url.startsWith('content:') ||
    url.startsWith('file:') ||
    CHART_EXT.test(lower)
  );
}

function ugUrlFromText(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/https?:\/\/(?:www\.)?(?:tabs\.)?ultimate-guitar\.com\/[^\s]+/i);
  return match?.[0] ?? null;
}

function isMediaShare(name?: string, mime?: string) {
  const type = (mime ?? '').toLowerCase();
  if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) return true;
  return /\.(png|jpe?g|gif|webp|mp3|mp4|m4a|wav|mov)$/i.test(name ?? '');
}

export function IncomingShare() {
  const { refresh } = useLibrary();
  const router = useRouter();
  const handled = useRef(new Set<string>());
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const [progress, setProgress] = useState<ImportProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [songId, setSongId] = useState<string | null>(null);

  const importUri = async (uri: string, name?: string) => {
    if (!uri || handled.current.has(uri)) return;
    handled.current.add(uri);
    try {
      const bytes = await readImportBytes(uri);
      await runChartImport(bytes, name ?? filenameFromUri(uri));
      await refresh();
    } catch (caught) {
      handled.current.delete(uri);
      const cancelled = caught instanceof Error && caught.name === 'AbortError';
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : 'Could not open that file.');
      setProgress({
        phase: 'done',
        totalSongs: 0,
        processedSongs: 0,
        created: 0,
        reused: 0,
        variants: 0,
        skipped: 0,
        failed: 0,
      });
    }
  };

  const importUg = async (url: string) => {
    if (handled.current.has(url)) return;
    handled.current.add(url);
    setError(null);
    setFinished(false);
    setProgress({
      phase: 'songs',
      totalSongs: 1,
      processedSongs: 0,
      created: 0,
      reused: 0,
      variants: 0,
      skipped: 0,
      failed: 0,
      currentTitle: 'Ultimate Guitar',
    });
    try {
      const tab = await importUgTab(url);
      const id = await saveSongFromUg(tab, url);
      await refresh();
      setProgress(null);
      await openSongInLive(router, id);
    } catch (caught) {
      handled.current.delete(url);
      setError(caught instanceof Error ? caught.message : 'Could not import that tab.');
    }
  };

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url || !looksLikeChartUrl(url)) return;
      void importUri(url);
    };
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    if (file?.path) {
      if (isMediaShare(file.fileName, file.mimeType)) {
        setError('Share a Songbook Pro, ChordPro, or OnSong file to import it.');
        setProgress({
          phase: 'done',
          totalSongs: 0,
          processedSongs: 0,
          created: 0,
          reused: 0,
          variants: 0,
          skipped: 0,
          failed: 0,
        });
        resetShareIntent();
        return;
      }
      void importUri(file.path, file.fileName ?? undefined).finally(() => resetShareIntent());
      return;
    }
    const ugUrl = ugUrlFromText(shareIntent.webUrl) ?? ugUrlFromText(shareIntent.text);
    if (ugUrl) {
      void importUg(ugUrl).finally(() => resetShareIntent());
      return;
    }
    if (shareIntent.text) {
      setError('That share is not a chart file or Ultimate Guitar link.');
      setProgress({
        phase: 'done',
        totalSongs: 0,
        processedSongs: 0,
        created: 0,
        reused: 0,
        variants: 0,
        skipped: 0,
        failed: 0,
      });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return (
    <ImportOverlay
      visible={Boolean(progress)}
      progress={progress}
      error={error}
      finished={finished}
      onCancel={() => {
        setProgress(null);
        setError(null);
        setFinished(false);
      }}
      onDone={() => {
        const opened = songId;
        setProgress(null);
        setError(null);
        setFinished(false);
        setSongId(null);
        if (error) return;
        if (opened) return;
        router.push('/(tabs)/sets' as Href);
      }}
    />
  );
}
