import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import {
  AI_PROVIDERS,
  getAiApiKey,
  getAiProvider,
  setAiApiKey,
  setAiProvider,
  type AiProviderId,
} from '@/src/lib/ai';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  /** Called after a successful save so parents can refresh empty-state. */
  onSaved?: () => void;
  compact?: boolean;
};

export function AiSettingsPanel({ onSaved, compact }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [provider, setProvider] = useState<AiProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const id = await getAiProvider();
    setProvider(id);
    const key = await getAiApiKey(id);
    setHasStoredKey(Boolean(key));
    setApiKey('');
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPickProvider = async (id: AiProviderId) => {
    setProvider(id);
    await setAiProvider(id);
    const key = await getAiApiKey(id);
    setHasStoredKey(Boolean(key));
    setApiKey('');
    setStatus(null);
  };

  const onSave = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await setAiProvider(provider);
      if (apiKey.trim()) {
        await setAiApiKey(provider, apiKey);
        setHasStoredKey(true);
        setApiKey('');
        setStatus('API key saved on this device.');
      } else if (!hasStoredKey) {
        setStatus('Paste an API key to save.');
        return;
      } else {
        setStatus('Provider updated.');
      }
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      await setAiApiKey(provider, '');
      setHasStoredKey(false);
      setApiKey('');
      setStatus('Key cleared for this provider.');
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const meta = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0];

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.heading}>AI provider (BYOK)</Text>
      <Text style={styles.hint}>
        Ultra stores your key in SecureStore on this device only. We never host a shared model key.
      </Text>

      <View style={styles.row}>
        {AI_PROVIDERS.map((p) => {
          const active = p.id === provider;
          return (
            <Pressable
              key={p.id}
              onPress={() => void onPickProvider(p.id)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>
        {meta.label} API key{hasStoredKey ? ' (saved — paste to replace)' : ''}
      </Text>
      <TextInput
        value={apiKey}
        onChangeText={setApiKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder={hasStoredKey ? '•••••••• (unchanged)' : meta.keyHint}
        placeholderTextColor={theme.faint}
        style={styles.input}
      />

      <BrandButton label="Save key" busy={busy} onPress={() => void onSave()} compact />
      {hasStoredKey ? (
        <Pressable style={styles.ghost} disabled={busy} onPress={() => void onClear()}>
          <Text style={styles.ghostText}>Clear saved key</Text>
        </Pressable>
      ) : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    wrap: {
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      marginBottom: 16,
    },
    wrapCompact: { marginBottom: 8 },
    heading: { color: t.text, fontWeight: '700' as const, fontSize: 16, marginBottom: 6 },
    hint: { color: t.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
    row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 },
    chip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.bg,
    },
    chipActive: { borderColor: t.accent, backgroundColor: t.bg },
    chipText: { color: t.muted, fontWeight: '600' as const, fontSize: 13 },
    chipTextActive: { color: t.accent },
    label: { color: t.text, fontWeight: '600' as const, marginBottom: 6, fontSize: 14 },
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
    ghost: { paddingVertical: 10, alignItems: 'center' as const },
    ghostText: { color: t.danger, fontWeight: '700' as const },
    status: { color: t.accent, marginTop: 8, fontWeight: '600' as const, fontSize: 13 },
  };
}
