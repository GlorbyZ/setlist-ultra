import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import {
  ensureSetlistUltraFolder,
  persistGoogleTokens,
  useGoogleDriveAuth,
} from '@/src/lib/google-drive';
import { config } from '@/src/lib/config';
import { getSyncState } from '@/src/lib/repository';

export default function SettingsScreen() {
  const { request, response, promptAsync } = useGoogleDriveAuth();
  const [syncInfo, setSyncInfo] = useState<string>('Not connected');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const state = await getSyncState();
      if (state?.accountEmail) {
        setSyncInfo(`Google Drive · ${state.accountEmail}`);
      }
    })();
  }, [response]);

  useEffect(() => {
    void (async () => {
      if (response?.type !== 'success') return;

      setBusy(true);
      try {
        const accessToken = response.authentication?.accessToken;
        await persistGoogleTokens(
          accessToken,
          response.authentication?.refreshToken,
          'connected',
        );

        if (accessToken) {
          const folderId = await ensureSetlistUltraFolder(accessToken);
          setSyncInfo(`Google Drive connected · folder ${folderId.slice(0, 8)}…`);
        }
      } catch (error) {
        Alert.alert(
          'Drive setup failed',
          error instanceof Error ? error.message : 'Unknown error',
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  const connectDrive = async () => {
    if (!config.googleWebClientId && !config.googleAndroidClientId) {
      Alert.alert(
        'Missing Google client ID',
        'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and/or EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to apps/mobile/.env',
      );
      return;
    }

    await promptAsync();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Cloud Storage</Text>
      <Text style={styles.body}>
        Connect Google Drive to store your library in a SetlistUltra folder you own.
      </Text>
      <Text style={styles.status}>{syncInfo}</Text>

      <Pressable
        style={[styles.button, (!request || busy) && styles.buttonDisabled]}
        disabled={!request || busy}
        onPress={connectDrive}>
        {busy ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Connect Google Drive</Text>
        )}
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>V1 scope</Text>
        <Text style={styles.cardBody}>
          Local library, UG import, transpose, setlists, and Drive folder setup. Full file sync
          ships in the next milestone.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>UG Proxy</Text>
        <Text style={styles.cardBody}>{config.ugProxyUrl}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  heading: { color: '#f8fafc', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  body: { color: '#94a3b8', lineHeight: 22, marginBottom: 12 },
  status: { color: '#f59e0b', marginBottom: 16, fontWeight: '600' },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: { color: '#f8fafc', fontWeight: '700', marginBottom: 6 },
  cardBody: { color: '#94a3b8', lineHeight: 20 },
});
