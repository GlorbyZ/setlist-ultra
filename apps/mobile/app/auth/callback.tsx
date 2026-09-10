import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { completeOAuthFromUrl, isOAuthOwnedBySettings } from '@/src/lib/hosted';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

function buildUrlFromParams(params: Record<string, string | string[] | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw) qs.set(key, raw);
  }
  const query = qs.toString();
  return query ? `setlistultra://auth/callback?${query}` : null;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const linkingUrl = Linking.useURL();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const initialPromise = Linking.getInitialURL();
    void (async () => {
      const initial = await initialPromise;
      const fromParams = buildUrlFromParams(params as Record<string, string | string[] | undefined>);
      const url = linkingUrl ?? initial ?? fromParams;
      if (!url || !hasAuthPayload(url)) return;
      if (started.current) return;
      started.current = true;

      try {
        await completeOAuthFromUrl(url);
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/settings');
      } catch (err) {
        if (isOAuthOwnedBySettings() && router.canGoBack()) {
          router.back();
          return;
        }
        setError(err instanceof Error ? err.message : 'Sign-in did not finish.');
      }
    })();
  }, [linkingUrl, params, router]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Could not finish signing in</Text>
          <Text style={styles.body}>{error}</Text>
          <BrandButton label="Back to Settings" onPress={() => router.replace('/(tabs)/settings')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.signing}>Signing in…</Text>
        </>
      )}
    </View>
  );
}

function hasAuthPayload(url: string) {
  return /(?:^|[?&#])(?:code|access_token)=/.test(url);
}

function makeStyles(t: AppTheme) {
  return {
    container: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 24,
      gap: 16,
    },
    signing: { color: t.text, fontWeight: '700' as const, fontSize: 18, marginTop: 8 },
    title: { color: t.text, fontWeight: '700' as const, fontSize: 20, textAlign: 'center' as const },
    body: { color: t.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' as const, marginBottom: 8 },
  };
}
