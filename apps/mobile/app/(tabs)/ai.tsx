import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { AiSettingsPanel } from '@/src/components/AiSettingsPanel';
import {
  AI_ACTION_CARDS,
  chatComplete,
  getAiApiKey,
  getAiProvider,
  hasAiApiKey,
  providerMeta,
  starterMessages,
  type AiActionCard,
  type AiProviderId,
  type ChatMessage,
  type LibraryContextStub,
} from '@/src/lib/ai';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AiScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { songs, setlists } = useLibrary();
  const listRef = useRef<FlatList<UiMessage>>(null);

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<AiProviderId>('gemini');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const libraryCtx: LibraryContextStub = useMemo(
    () => ({
      songCount: songs.length,
      setlistCount: setlists.length,
      sampleTitles: songs.slice(0, 40).map((s) => s.title || 'Untitled'),
    }),
    [songs, setlists],
  );

  const refreshConfig = useCallback(async () => {
    const id = await getAiProvider();
    setProvider(id);
    const ok = await hasAiApiKey(id);
    setConfigured(ok);
    setReady(true);
    if (!ok) setShowSettings(true);
  }, []);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const runChat = useCallback(
    async (history: ChatMessage[]) => {
      setBusy(true);
      setError(null);
      try {
        const id = await getAiProvider();
        const apiKey = await getAiApiKey(id);
        if (!apiKey) {
          setConfigured(false);
          setShowSettings(true);
          setError('Add an API key to chat.');
          return;
        }
        const result = await chatComplete(id, { apiKey, messages: history });
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', content: result.text },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onSend = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    setDraft('');
    const userMsg: UiMessage = { id: newId(), role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);

    const prior: ChatMessage[] = [
      ...starterMessages('', libraryCtx),
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content },
    ];
    await runChat(prior);
  };

  const onAction = async (card: AiActionCard) => {
    if (card.id === 'ask') {
      setDraft('');
      return;
    }
    if (!configured) {
      setShowSettings(true);
      return;
    }
    const seeded = card.starter;
    setMessages((prev) => [...prev, { id: newId(), role: 'user', content: seeded }]);
    await runChat(starterMessages(seeded, libraryCtx));
  };

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, busy]);

  if (!ready) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const meta = providerMeta(provider);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>AI</Text>
          <Text style={styles.sub}>
            {configured ? `${meta.label} · BYOK` : 'Add your API key to start'}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowSettings((v) => !v)}
          style={styles.gear}
          accessibilityLabel="AI settings">
          <Ionicons name="key-outline" size={22} color={theme.accent} />
        </Pressable>
      </View>

      {showSettings || !configured ? (
        <ScrollView contentContainerStyle={styles.settingsPad}>
          <AiSettingsPanel
            onSaved={() => {
              void (async () => {
                await refreshConfig();
                const ok = await hasAiApiKey();
                if (ok) setShowSettings(false);
              })();
            }}
          />
          {!configured ? (
            <Text style={styles.emptyHint}>
              Day-one AI home uses your own Gemini (default), OpenAI, or Anthropic key. Keys never leave
              this device except to call the provider you pick.
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
            style={styles.cardsScroll}>
            {AI_ACTION_CARDS.map((card) => (
              <Pressable key={card.id} style={styles.card} onPress={() => void onAction(card)}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSub}>{card.subtitle}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <FlatList
            ref={listRef}
            data={messages.filter((m) => m.role !== 'system')}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Action cards + chat</Text>
                <Text style={styles.emptyBody}>
                  Library stub: {libraryCtx.songCount} songs · {libraryCtx.setlistCount} sets. Tap a
                  card or ask anything below.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                ]}>
                <Text style={item.role === 'user' ? styles.bubbleUserText : styles.bubbleText}>
                  {item.content}
                </Text>
              </View>
            )}
            ListFooterComponent={
              busy ? (
                <View style={styles.typing}>
                  <ActivityIndicator color={theme.accent} />
                  <Text style={styles.typingText}>Thinking…</Text>
                </View>
              ) : null
            }
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask Setlist Ultra AI…"
              placeholderTextColor={theme.faint}
              style={styles.composerInput}
              multiline
              editable={!busy}
              onSubmitEditing={() => void onSend()}
            />
            <Pressable
              style={[styles.send, (!draft.trim() || busy) && styles.sendDisabled]}
              disabled={!draft.trim() || busy}
              onPress={() => void onSend()}>
              <Ionicons name="send" size={18} color={theme.accentText} />
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    center: { alignItems: 'center' as const, justifyContent: 'center' as const },
    headerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 12,
    },
    headerCopy: { flex: 1 },
    title: { color: t.text, fontSize: 22, fontWeight: '700' as const },
    sub: { color: t.muted, marginTop: 2, fontSize: 13 },
    gear: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
    },
    settingsPad: { padding: 16, paddingBottom: 40 },
    emptyHint: { color: t.muted, fontSize: 13, lineHeight: 18 },
    cardsScroll: { maxHeight: 104, flexGrow: 0 },
    cardsRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
    card: {
      width: 148,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      padding: 12,
    },
    cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 14 },
    cardSub: { color: t.muted, marginTop: 4, fontSize: 12, lineHeight: 16 },
    listContent: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
    emptyBox: {
      marginTop: 24,
      padding: 16,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
    },
    emptyTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16, marginBottom: 6 },
    emptyBody: { color: t.muted, fontSize: 13, lineHeight: 18 },
    bubble: {
      maxWidth: '92%' as const,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
    },
    bubbleUser: {
      alignSelf: 'flex-end' as const,
      backgroundColor: t.accent,
    },
    bubbleAssistant: {
      alignSelf: 'flex-start' as const,
      backgroundColor: t.panel,
      borderWidth: 1,
      borderColor: t.border,
    },
    bubbleText: { color: t.text, fontSize: 15, lineHeight: 22 },
    bubbleUserText: { color: t.accentText, fontSize: 15, lineHeight: 22 },
    typing: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      paddingVertical: 8,
    },
    typingText: { color: t.muted, fontSize: 13 },
    error: {
      color: t.danger,
      paddingHorizontal: 16,
      paddingBottom: 6,
      fontSize: 13,
    },
    composer: {
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.bg,
    },
    composerInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: t.text,
      fontSize: 16,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: t.accent,
    },
    sendDisabled: { opacity: 0.4 },
  };
}
