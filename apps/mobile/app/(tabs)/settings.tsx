import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandDialog } from '@/src/components/BrandDialog';
import { AiSettingsPanel } from '@/src/components/AiSettingsPanel';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { isHostedConfigured } from '@/src/lib/config';
import { cleanDuplicateSongs, cleanDuplicateSetlists, exportSbpBytes } from '@/src/lib/repository';
import { saveBinaryFile } from '@/src/lib/files';
import {
  hostedSessionEmail,
  hostedSignIn,
  hostedSignInWithGoogle,
  hostedSignOut,
  hostedSignUp,
  isGoogleAuthConfigured,
  syncPersonalLibrary,
} from '@/src/lib/hosted';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { refresh } = useLibrary();
  const styles = useThemedStyles(makeStyles);
  const hosted = isHostedConfigured();
  const googleReady = isGoogleAuthConfigured();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(hosted ? 'Local library' : 'Cloud sync is off. Using this device only.');
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!hosted) return;
    void hostedSessionEmail().then((value) => {
      setSessionEmail(value);
      if (value) setStatus(`Signed in as ${value}`);
    });
  }, [hosted]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      setDialog({ title: 'Could not finish', body: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>AI</Text>
      <Text style={styles.body}>Bring your own API key (Gemini default). Keys stay in SecureStore on this device.</Text>
      <AiSettingsPanel compact />

      <Text style={styles.heading}>Look & Stage</Text>
      <Pressable style={styles.navRow} onPress={() => router.push('/look')}>
        <View style={styles.toolCopy}>
          <Text style={styles.navTitle}>Presets, chart, Live tools</Text>
          <Text style={styles.navHint}>Theme, type size, page mode, and which buttons show on stage.</Text>
        </View>
        <Text style={styles.navChevron}>›</Text>
      </Pressable>

      <Text style={styles.heading}>Sync</Text>
      {hosted ? (
        <>
          <Text style={styles.body}>Cloud backup when signed in (email or Google).</Text>
          <Text style={styles.status}>{status}</Text>
          {sessionEmail ? (
            <>
              <Text style={styles.signedIn}>{sessionEmail}</Text>
              <Pressable
                style={styles.ghost}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await hostedSignOut();
                    setSessionEmail(null);
                    setStatus('Signed out · local only');
                  })
                }>
                <Text style={styles.ghostText}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.card}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor={theme.faint}
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor={theme.faint}
                style={styles.input}
              />
              <BrandButton
                label="Sign in"
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    await hostedSignIn(email.trim(), password);
                    setSessionEmail(email.trim());
                    setStatus(`Signed in as ${email.trim()}`);
                  })
                }
              />
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
              {googleReady ? (
                <BrandButton
                  label="Continue with Google"
                  busy={busy}
                  icon={<AntDesign name="google" size={18} color={theme.accentText} />}
                  onPress={() =>
                    void run(async () => {
                      const user = await hostedSignInWithGoogle();
                      const signed = user.email ?? 'Google account';
                      setSessionEmail(signed);
                      setStatus(`Signed in as ${signed}`);
                    })
                  }
                />
              ) : null}
            </View>
          )}
          <BrandButton
            label="Sync now"
            disabled={!sessionEmail}
            busy={busy}
            onPress={() =>
              void run(async () => {
                await syncPersonalLibrary();
                await refresh();
                setStatus('Catalog + library synced');
              })
            }
          />
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cloud sync is off.</Text>
          <Text style={styles.cardBody}>Using this device only.</Text>
        </View>
      )}

      <Text style={styles.heading}>Library</Text>
      <Pressable
        style={styles.secondary}
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const result = await cleanDuplicateSongs();
            await refresh();
            setDialog({
              title: 'Duplicates cleaned',
              body:
                result.removed === 0
                  ? 'No duplicate songs found.'
                  : `Merged ${result.mergedGroups} group(s) and removed ${result.removed} duplicate song(s). Setlists were updated.`,
            });
          })
        }>
        <Text style={styles.secondaryText}>Clean duplicates</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const result = await cleanDuplicateSetlists();
            await refresh({ setlistsOnly: true });
            setDialog({
              title: 'Duplicate sets cleaned',
              body:
                result.removed === 0
                  ? 'No duplicate setlists found.'
                  : `Removed ${result.removed} duplicate setlist(s). Songs stay in your library.`,
            });
          })
        }>
        <Text style={styles.secondaryText}>Clean duplicate sets</Text>
      </Pressable>

      <Text style={styles.heading}>Backup</Text>
      <Pressable
        style={styles.secondary}
        onPress={() =>
          void run(async () => {
            const bytes = await exportSbpBytes('backup');
            await saveBinaryFile('setlist-ultra.sbpbackup', bytes);
          })
        }>
        <Text style={styles.secondaryText}>Export .sbpbackup</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pedals</Text>
        <Text style={styles.cardBody}>Map page-turners. Page Up/Down and arrows turn pages.</Text>
        <Text style={styles.cardBody}>This device: {Platform.OS}</Text>
      </View>

      <BrandDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        body={dialog?.body}
        onClose={() => setDialog(null)}
        actions={[{ label: 'OK', onPress: () => setDialog(null) }]}
      />
    </ScrollView>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Unknown error';
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48 },
    heading: { color: t.text, fontSize: t.type.title.fontSize + 2, lineHeight: t.type.title.lineHeight + 2, fontWeight: t.type.title.fontWeight, marginBottom: 8, marginTop: 12 },
    navRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 8,
      gap: 12,
    },
    toolCopy: { flex: 1 },
    navTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    navHint: { color: t.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },
    navChevron: { color: t.muted, fontSize: 28, lineHeight: 32, fontWeight: '300' as const },
    body: { color: t.muted, fontSize: t.type.body.fontSize, lineHeight: t.type.body.lineHeight, fontWeight: t.type.body.fontWeight, marginBottom: 12 },
    status: { color: t.accent, marginBottom: 16, fontWeight: '600' as const },
    signedIn: { color: t.text, fontWeight: '700' as const, marginBottom: 4 },
    input: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
    },
    ghost: { paddingVertical: 12, alignItems: 'center' as const },
    ghostText: { color: t.accent, fontWeight: '700' as const },
    secondary: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.md,
      paddingVertical: 14,
      alignItems: 'center' as const,
      marginBottom: 12,
      backgroundColor: t.panel,
    },
    secondaryText: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    card: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    cardTitle: { color: t.text, fontSize: t.type.body.fontSize, lineHeight: t.type.body.lineHeight, fontWeight: '700' as const, marginBottom: 6 },
    cardBody: { color: t.muted, fontSize: t.type.meta.fontSize, lineHeight: t.type.meta.lineHeight + 2, fontWeight: t.type.meta.fontWeight, marginBottom: 8 },
  };
}
