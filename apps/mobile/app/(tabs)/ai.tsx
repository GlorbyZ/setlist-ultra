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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { AiSettingsPanel } from '@/src/components/AiSettingsPanel';
import { applyApprovedProposal, undoLastAiApply } from '@/src/lib/ai/apply';
import {
  AI_ACTION_CARDS,
  getAiApiKey,
  getAiProvider,
  hasAiApiKey,
  isLiveSessionActive,
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
  type ProposalEnvelope,
} from '@/src/lib/ai';
import { getSong } from '@/src/lib/repository';
import { launchFlags } from '@/src/lib/launchFlags';
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

export default function AiScreen() {
  if (!launchFlags.ai) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text>AI tools are off in this build.</Text>
      </View>
    );
  }
  return <AiScreenInner />;
}

function AiScreenInner() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ task?: string; songId?: string }>();
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
  const [proposal, setProposal] = useState<ProposalEnvelope | null>(null);
  const [lastTask, setLastTask] = useState<AiTaskResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedNote, setAppliedNote] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [chartConsent, setChartConsent] = useState<LibraryContextStub['chartConsent']>();

  const libraryCtx: LibraryContextStub = useMemo(
    () => ({
      songCount: songs.length,
      setlistCount: setlists.length,
      sampleTitles: songs.slice(0, 40).map((s) => s.title || 'Untitled'),
      songs: songs.slice(0, 400).map((s) => ({
        id: s.id,
        title: s.title || 'Untitled',
        artist: s.artist || '',
        durationSeconds: s.duration2 ?? s.durationSeconds,
        tags: s.tags,
        originalKey: s.originalKey,
        localRevision: s.localRevision,
      })),
      chartConsent,
      liveActive: isLiveSessionActive(),
    }),
    [songs, setlists, chartConsent],
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
          chartConsent: libraryCtx.chartConsent,
          signal: controller.signal,
          allowModelFallback: taskType === 'chat',
        });
        setLastTask(result);
        setProposal(result.envelope);
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
    [cancelInFlight, libraryCtx.songs, libraryCtx.chartConsent],
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
        : taskMessages(taskType, content, libraryCtx);
    await runTask(taskType, history);
  };

  const onAction = async (card: AiActionCard) => {
    if (!configured) {
      setShowSettings(true);
      return;
    }
    const seeded =
      card.id === 'fix-chart' && chartConsent
        ? `${card.starter}\n\nSong: ${chartConsent.title} (${chartConsent.songId})`
        : card.starter;
    setMessages((prev) => [...prev, { id: newId(), role: 'user', content: seeded }]);
    await runTask(card.id, taskMessages(card.id, seeded, libraryCtx));
  };

  const onApply = async () => {
    if (!proposal || applying) return;
    setApplying(true);
    setError(null);
    try {
      const receipt = await applyApprovedProposal(proposal, { contentHash: proposal.contentHash });
      setAppliedNote(receipt.summary);
      setCanUndo(Boolean(receipt.undo));
      setProposal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const onUndo = async () => {
    if (applying) return;
    setApplying(true);
    setError(null);
    try {
      const note = await undoLastAiApply();
      setAppliedNote(note);
      setCanUndo(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed');
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

  useEffect(() => {
    const songId = typeof params.songId === 'string' ? params.songId : undefined;
    if (!songId) {
      setChartConsent(undefined);
      return;
    }
    void getSong(songId).then((row) => {
      if (!row) return;
      setChartConsent({ songId: row.id, title: row.title, chordpro: row.chordpro ?? '' });
    });
  }, [params.songId]);

  const consumedDeepLink = useRef<string | null>(null);

  useEffect(() => {
    const task = params.task;
    const key = `${task ?? ''}:${params.songId ?? ''}`;
    if (!configured || !task || busy || consumedDeepLink.current === key) return;
    if (task === 'fix-chart' && params.songId && !chartConsent) return;
    if (task === 'build-set' || task === 'fix-chart' || task === 'clean-import' || task === 'ask-library') {
      const card = AI_ACTION_CARDS.find((item) => item.id === task);
      if (!card) return;
      consumedDeepLink.current = key;
      void onAction(card);
    }
  }, [configured, params.task, params.songId, busy, chartConsent]);

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
              Preparation assistant uses your own Gemini, OpenAI, or Anthropic key (BYOK). Hosted AI Plus is not
              in this build. Keys stay on this device. Writes wait for Apply and can Undo if you have not edited
              since. Core songbook works without AI.
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
                <Text style={styles.emptyTitle}>Build, clean, then Apply</Text>
                <Text style={styles.emptyBody}>
                  Scope: this library ({libraryCtx.songCount} songs, {libraryCtx.setlistCount} sets). Search stays
                  on device; only retrieved ids (and a chart you opened Clean up on) go to your provider. Apply is
                  blocked while Live is focused. Chat never switches providers.
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
                  <Text style={styles.typingText}>{chartConsent ? 'Drafting with consented chart…' : 'Searching library, then drafting…'}</Text>
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
                {proposal.body.uncertain ? ' · uncertain' : ''}
                {libraryCtx.liveActive ? ' · Live is on stage' : ''}
              </Text>
              {proposal.diffLines.slice(0, 12).map((line) => (
                <Text key={line} style={styles.previewBody}>
                  {line}
                </Text>
              ))}
              {proposal.warnings.map((line) => (
                <Text key={line} style={styles.previewBody}>
                  {line}
                </Text>
              ))}
              {proposal.assumptions.map((line) => (
                <Text key={line} style={styles.previewBody}>
                  Assumption: {line}
                </Text>
              ))}
              {proposal.body.kind === 'set' && proposal.estimatedSeconds ? (
                <Text style={styles.previewBody}>
                  Known duration {Math.round(proposal.estimatedSeconds / 60)} min
                  {proposal.missingDurationIds.length ? ` · ${proposal.missingDurationIds.length} song(s) missing duration` : ''}
                </Text>
              ) : null}
              <View style={styles.previewRow}>
                <Pressable style={styles.ghost} onPress={() => setProposal(null)} disabled={applying}>
                  <Text style={styles.ghostText}>Discard</Text>
                </Pressable>
                {proposal.body.kind === 'library' ? (
                  <Pressable
                    style={styles.apply}
                    onPress={() => {
                      const first = proposal.body.kind === 'library' ? proposal.body.songIds[0] : undefined;
                      if (first) router.push(`/song/${first}`);
                    }}>
                    <Text style={styles.applyText}>Open</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.apply} onPress={() => void onApply()} disabled={applying}>
                    <Text style={styles.applyText}>{applying ? 'Applying…' : 'Apply'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {appliedNote ? <Text style={styles.applied}>{appliedNote}</Text> : null}
          {canUndo ? (
            <Pressable style={styles.ghost} onPress={() => void onUndo()} disabled={applying}>
              <Text style={styles.ghostText}>{applying ? 'Working…' : 'Undo last Apply'}</Text>
            </Pressable>
          ) : null}
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
