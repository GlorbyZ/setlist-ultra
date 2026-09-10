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
import { applyChartPatch, applySetProposal } from '@/src/lib/ai/apply';
import {
  AI_ACTION_CARDS,
  getAiApiKey,
  getAiProvider,
  hasAiApiKey,
  providerMeta,
  runAiTask,
  starterMessages,
  taskMessages,
  userFacingAiError,
  type AiActionCard,
  type AiProviderId,
  type AiTaskResult,
  type AiTaskType,
  type ChatMessage,
  type LibraryContextStub,
  type ValidatedProposal,
} from '@/src/lib/ai';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  usedFallback?: boolean;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function taskTypeForCard(card: AiActionCard): AiTaskType {
  if (card.id === 'ask') return 'chat';
  return card.id;
}

export default function AiScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { songs, setlists, refresh } = useLibrary();
  const listRef = useRef<FlatList<UiMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<AiProviderId>('gemini');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ValidatedProposal | null>(null);
  const [lastTask, setLastTask] = useState<AiTaskResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedNote, setAppliedNote] = useState<string | null>(null);

  const libraryCtx: LibraryContextStub = useMemo(
    () => ({
      songCount: songs.length,
      setlistCount: setlists.length,
      sampleTitles: songs.slice(0, 40).map((s) => s.title || 'Untitled'),
      songs: songs.slice(0, 80).map((s) => ({ id: s.id, title: s.title || 'Untitled', artist: s.artist || '' })),
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

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runTask = useCallback(
    async (taskType: AiTaskType, history: ChatMessage[]) => {
      cancelInFlight();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setError(null);
      setAppliedNote(null);
      setProposal(null);
      try {
        const id = await getAiProvider();
        const apiKey = await getAiApiKey(id);
        if (!apiKey) {
          setConfigured(false);
          setShowSettings(true);
          setError('Add an API key to chat.');
          return;
        }
        const result = await runAiTask({
          taskType,
          provider: id,
          apiKey,
          messages: history,
          librarySongs: libraryCtx.songs,
          signal: controller.signal,
          allowModelFallback: taskType === 'chat',
        });
        setLastTask(result);
        setProposal(result.proposal);
        const fallbackNote = result.usedFallback ? `\n\n(Used fallback model ${result.model} — same provider.)` : '';
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: `${result.text}${fallbackNote}`,
            model: result.model,
            usedFallback: result.usedFallback,
          },
        ]);
      } catch (err) {
        setError(userFacingAiError(err));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
      }
    },
    [cancelInFlight, libraryCtx.songs],
  );

  const onSend = async (text?: string, taskType: AiTaskType = 'chat') => {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    setDraft('');
    const userMsg: UiMessage = { id: newId(), role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);

    const history: ChatMessage[] =
      taskType === 'chat'
        ? [
            ...starterMessages('', libraryCtx),
            ...messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user', content },
          ]
        : taskMessages(taskType as Exclude<AiActionCard['id'], 'ask'>, content, libraryCtx);
    await runTask(taskType, history);
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
    await runTask(taskTypeForCard(card), taskMessages(card.id, seeded, libraryCtx));
  };

  const onApply = async () => {
    if (!proposal || applying) return;
    setApplying(true);
    setError(null);
    try {
      if (proposal.kind === 'set') {
        const applied = await applySetProposal(proposal);
        setAppliedNote(`Created set “${applied.title}” with ${applied.songCount} songs.`);
      } else {
        const applied = await applyChartPatch(proposal);
        setAppliedNote(applied.created ? 'Saved as a new chart.' : 'Updated the existing chart.');
      }
      setProposal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, busy, proposal]);

  useEffect(() => () => cancelInFlight(), [cancelInFlight]);

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
            {configured
              ? `${meta.label} · ${meta.defaultModel} · BYOK`
              : 'Add your API key to start'}
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
              this device except to call the provider you pick. AI never writes your library until you tap Apply.
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
                  Library catalog: {libraryCtx.songCount} songs · {libraryCtx.setlistCount} sets (ids only, no
                  chart bodies). Typed tasks validate JSON and wait for Apply. Chat may fall back within the
                  same provider; it never switches providers.
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
                {item.role === 'assistant' && item.model ? (
                  <Text style={styles.modelTag}>
                    {item.model}
                    {item.usedFallback ? ' · fallback' : ''}
                  </Text>
                ) : null}
              </View>
            )}
            ListFooterComponent={
              busy ? (
                <View style={styles.typing}>
                  <ActivityIndicator color={theme.accent} />
                  <Text style={styles.typingText}>Thinking…</Text>
                  <Pressable onPress={cancelInFlight} style={styles.cancelChip}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />

          {proposal ? (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>
                Preview — not saved
                {proposal.uncertain ? ' · uncertain' : ''}
              </Text>
              {proposal.kind === 'set' ? (
                <Text style={styles.previewBody}>
                  Set “{proposal.title}” · {proposal.songs.length} library songs
                  {proposal.inventedIds.length ? ` · ignored ${proposal.inventedIds.length} unknown ids` : ''}
                </Text>
              ) : (
                <Text style={styles.previewBody} numberOfLines={4}>
                  {proposal.songId ? `Update ${proposal.title ?? 'chart'}` : 'Create a new chart'} ·{' '}
                  {proposal.chordpro.slice(0, 180)}
                </Text>
              )}
              <View style={styles.previewRow}>
                <Pressable style={styles.ghost} onPress={() => setProposal(null)} disabled={applying}>
                  <Text style={styles.ghostText}>Discard</Text>
                </Pressable>
                <Pressable style={styles.apply} onPress={() => void onApply()} disabled={applying}>
                  <Text style={styles.applyText}>{applying ? 'Applying…' : 'Apply'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {appliedNote ? <Text style={styles.applied}>{appliedNote}</Text> : null}
          {lastTask && !proposal ? (
            <Text style={styles.requestId}>
              {lastTask.provider} · {lastTask.model} · {lastTask.requestId}
            </Text>
          ) : null}
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
    modelTag: { color: t.faint, fontSize: 11, marginTop: 6 },
    typing: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      paddingVertical: 8,
    },
    typingText: { color: t.muted, fontSize: 13 },
    cancelChip: {
      marginLeft: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
    },
    cancelText: { color: t.text, fontSize: 12, fontWeight: '600' as const },
    preview: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.accent,
      backgroundColor: t.panel,
      gap: 8,
    },
    previewTitle: { color: t.text, fontWeight: '700' as const, fontSize: 14 },
    previewBody: { color: t.muted, fontSize: 13, lineHeight: 18 },
    previewRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10 },
    ghost: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    ghostText: { color: t.text, fontWeight: '600' as const },
    apply: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: t.accent,
    },
    applyText: { color: t.accentText, fontWeight: '700' as const },
    applied: { color: t.muted, paddingHorizontal: 16, paddingBottom: 4, fontSize: 13 },
    requestId: { color: t.faint, paddingHorizontal: 16, paddingBottom: 4, fontSize: 11 },
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
