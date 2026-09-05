import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandDialog } from '@/src/components/BrandDialog';
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
import { THEME_OPTIONS, useTheme, useThemedStyles, type AppTheme, type ThemeId } from '@/src/theme';

export default function SettingsScreen() {
  const { theme, themeId, setThemeId } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hosted = isHostedConfigured();
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
      setDialog({ title: 'Could not finish', body: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Appearance</Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map((option) => {
          const on = themeId === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.themeChip, on && styles.themeChipOn]}
              onPress={() => void setThemeId(option.id as ThemeId)}>
              <View style={[styles.themeSwatch, { backgroundColor: swatchColor(option.id) }]} />
              <Text style={[styles.themeLabel, on && styles.themeLabelOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.heading}>Sync</Text>
      {hosted ? (
        <>
          <Text style={styles.body}>Cloud backup when signed in.</Text>
          <Text style={styles.status}>{status}</Text>
          {sessionEmail ? (
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
            </View>
          )}
          <BrandButton
            label="Sync now"
            disabled={!sessionEmail}
            busy={busy}
            onPress={() =>
              void run(async () => {
                await syncPersonalLibrary();
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
              setDialog({ title: 'Pushed', body: `Snapshot sent to ${config.managerUrl}` });
            })
          }>
          <Text style={styles.ghostText}>Push library to Manager</Text>
        </Pressable>
      </View>

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

function swatchColor(id: ThemeId) {
  if (id === 'ultra-light') return '#FFFFFF';
  if (id === 'system') return '#8E8E93';
  return '#000000';
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48 },
    heading: { color: t.text, fontSize: 22, fontWeight: '800' as const, marginBottom: 8, marginTop: 12 },
    body: { color: t.muted, lineHeight: 22, marginBottom: 12 },
    status: { color: t.accent, marginBottom: 16, fontWeight: '600' as const },
    themeRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 8 },
    themeChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    themeChipOn: { borderColor: t.accent },
    themeSwatch: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.border,
    },
    themeLabel: { color: t.muted, fontWeight: '700' as const, fontSize: 12 },
    themeLabelOn: { color: t.text },
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
    cardTitle: { color: t.text, fontWeight: '700' as const, marginBottom: 6 },
    cardBody: { color: t.muted, lineHeight: 20, marginBottom: 8 },
  };
}
