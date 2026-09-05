import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { filenameFromUri } from '@/src/lib/format';
import { readBytesFromUri } from '@/src/lib/files';
import { importAnyChartFile, saveSongFromUg } from '@/src/lib/repository';
import { importUgTab } from '@/src/lib/ug-api';
import { useLibrary } from '@/src/providers/LibraryProvider';

function looksLikeChartUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    url.startsWith('content:') ||
    url.startsWith('file:') ||
    lower.includes('.sbp') ||
    lower.includes('.sbpbackup') ||
    lower.includes('.cho') ||
    lower.includes('.chopro') ||
    lower.includes('.crd')
  );
}

function ugUrlFromText(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/https?:\/\/(?:www\.)?(?:tabs\.)?ultimate-guitar\.com\/[^\s]+/i);
  return match?.[0] ?? null;
}

export function IncomingShare() {
  const { refresh } = useLibrary();
  const router = useRouter();
  const handled = useRef(new Set<string>());
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  const importUri = async (uri: string, name?: string) => {
    if (!uri || handled.current.has(uri)) return;
    handled.current.add(uri);
    try {
      const bytes = await readBytesFromUri(uri);
      const result = await importAnyChartFile(bytes, name ?? filenameFromUri(uri));
      await refresh();
      if (result.kind === 'song' && result.songId) {
        router.push(`/song/${result.songId}` as Href);
        return;
      }
      Alert.alert('Imported', `${result.songs} songs, ${result.sets} sets`);
      router.push('/(tabs)/sets' as Href);
    } catch (error) {
      handled.current.delete(uri);
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not open that file.');
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
      void importUri(file.path, file.fileName ?? undefined).finally(() => resetShareIntent());
      return;
    }
    const ugUrl = ugUrlFromText(shareIntent.webUrl) ?? ugUrlFromText(shareIntent.text);
    if (ugUrl && !handled.current.has(ugUrl)) {
      handled.current.add(ugUrl);
      void (async () => {
        try {
          const tab = await importUgTab(ugUrl);
          const songId = await saveSongFromUg(tab, ugUrl);
          await refresh();
          router.push(`/song/${songId}` as Href);
        } catch (error) {
          handled.current.delete(ugUrl);
          Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not import that tab.');
        } finally {
          resetShareIntent();
        }
      })();
      return;
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
