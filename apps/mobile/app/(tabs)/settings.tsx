import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { config, isHostedConfigured } from '@/src/lib/config';
import { exportSbpBytes } from '@/src/lib/repository';
import { saveBinaryFile } from '@/src/lib/files';
import {
  hostedSessionEmail,
  hostedSignIn,
  hostedSignOut,
  hostedSignUp,
  syncPersonalLibrary,
} from '@/src/lib/hosted';
import { managerClientHint, pushSnapshotToManager } from '@/src/lib/manager';
import { colors } from '@/src/theme';

export default function SettingsScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Local library (SQLite)');

  useEffect(() => {
    void hostedSessionEmail().then((value) => {
      setSessionEmail(value);
      if (value) setStatus(`Signed in as ${value}`);
    });
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Account</Text>
      <Text style={styles.body}>
        {isHostedConfigured()
          ? 'Email auth syncs a personal library and the shared chart catalog. Apple Sign In is required later if you add other social logins on iOS.'
          : 'Hosted sync is optional. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable accounts. The app works fully offline without them.'}
      </Text>
      <Text style={styles.status}>{status}</Text>
      {sessionEmail ? (
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await hostedSignOut();
              setSessionEmail(null);
              setStatus('Signed out · local only');
            })
          }>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <Pressable
            style={styles.button}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await hostedSignIn(email.trim(), password);
                setSessionEmail(email.trim());
                setStatus(`Signed in as ${email.trim()}`);
              })
            }>
            {busy ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          <Pressable
            style={styles.ghost}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await hostedSignUp(email.trim(), password);
                setStatus('Check email to confirm, then sign in.');
              })
            }>
            <Text style={styles.ghostText}>Create account</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={styles.button}
        disabled={busy || !sessionEmail}
        onPress={() =>
          void run(async () => {
            await syncPersonalLibrary();
            setStatus('Catalog + library synced');
          })
        }>
        <Text style={styles.buttonText}>Sync now</Text>
      </Pressable>

      <Text style={styles.heading}>Backup</Text>
      <Pressable
        style={styles.button}
        onPress={() =>
          void run(async () => {
            const bytes = await exportSbpBytes('backup');
            await saveBinaryFile('setlist-ultra.sbpbackup', bytes);
          })
        }>
        <Text style={styles.buttonText}>Export .sbpbackup</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>UG proxy</Text>
        <Text style={styles.cardBody}>{config.ugProxyUrl}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>LAN Manager</Text>
        <Text style={styles.cardBody}>{managerClientHint()}</Text>
        <Text style={styles.cardBody}>{config.managerUrl}</Text>
        <Pressable
          style={styles.ghost}
          onPress={() =>
            void run(async () => {
              await pushSnapshotToManager();
              Alert.alert('Pushed', `Library snapshot sent to ${config.managerUrl}`);
            })
          }>
          <Text style={styles.ghostText}>Push library to Manager</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live extras</Text>
        <Text style={styles.cardBody}>
          HID pedals: Page Up/Down and arrows turn pages (AirTurn-class). Web MIDI program-change runs when a song has
          midiOnLoad. Camera scan and PDF live under Add. Print is in the song editor.
        </Text>
        <Text style={styles.cardBody}>This device: {Platform.OS}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  body: { color: colors.muted, lineHeight: 22, marginBottom: 12 },
  status: { color: colors.accent, marginBottom: 16, fontWeight: '600' },
  input: {
    backgroundColor: colors.border,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: colors.accentText, fontWeight: '700', fontSize: 16 },
  ghost: { paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: colors.accent, fontWeight: '700' },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  cardBody: { color: colors.muted, lineHeight: 20, marginBottom: 8 },
});
