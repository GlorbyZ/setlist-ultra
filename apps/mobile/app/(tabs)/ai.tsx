import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { applyApprovedProposal, undoLastAiApply } from '@/src/lib/ai/apply';
import {
  AI_ACTION_CARDS,
  composeTaskUserText,
  getAiApiKey,
  getAiProvider,
  getPreferByok,
  hasAiAccess,
  isLiveSessionActive,
  primaryActionLabel,
  primaryTaskAction,
  reviewLines,
  reviewTitle,
  runAiTask,
  shouldUseHostedGateway,
  songDisplayName,
  stripInternalPayload,
  taskMessages,
  userFacingAssistError,
  type AiActionCard,
  type AiActionId,
  type AiTaskResult,
  type AssistTaskFields,
  type LibraryContextStub,
  type ProposalEnvelope,
} from '@/src/lib/ai';
import { getSong } from '@/src/lib/repository';
import { launchFlags } from '@/src/lib/launchFlags';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Phase = 'home' | 'setup' | 'working' | 'review' | 'applied';

export default function AssistScreen() {
  if (!launchFlags.ai) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text>Assist is off in this build.</Text>
      </View>
    );
  }
  return <AssistScreenInner />;
}

function AssistScreenInner() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ task?: string; songId?: string }>();
  const { songs, setlists, refresh } = useLibrary();
  const abortRef = useRef<AbortController | null>(null);

  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState(false);
  const [hosted, setHosted] = useState(false);
  const [preferByok, setPreferByokState] = useState(false);
  const [phase, setPhase] = useState<Phase>('home');
  const [task, setTask] = useState<AiActionId | null>(null);
  const [fields, setFields] = useState<AssistTaskFields>({ source: 'library', songCount: '8' });
  const [songQuery, setSongQuery] = useState('');
  const [refine, setRefine] = useState('');
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
    const byok = await getPreferByok();
    setPreferByokState(byok);
    setHosted(shouldUseHostedGateway() && !byok);
    setAccess(await hasAiAccess(id));
    setReady(true);
  }, []);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

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

  const openTask = useCallback((id: AiActionId) => {
    setTask(id);
    setPhase('setup');
    setError(null);
    setProposal(null);
    setAppliedNote(null);
    setRefine('');
    setFields((prev) => ({ ...prev, refine: undefined }));
  }, []);

  const consumedDeepLink = useRef<string | null>(null);
  useEffect(() => {
    const deepTask = params.task;
    const key = `${deepTask ?? ''}:${params.songId ?? ''}`;
    if (!deepTask || consumedDeepLink.current === key) return;
    if (deepTask === 'build-set' || deepTask === 'fix-chart' || deepTask === 'clean-import' || deepTask === 'ask-library') {
      consumedDeepLink.current = key;
      openTask(deepTask);
    }
  }, [params.task, params.songId, openTask]);

  const canGenerate = useMemo(() => {
    if (!task) return false;
    if (task === 'clean-import') return Boolean(fields.paste?.trim());
    if (task === 'fix-chart') return Boolean(chartConsent?.songId);
    if (task === 'ask-library') return Boolean(fields.query?.trim());
    return true;
  }, [task, fields.paste, fields.query, chartConsent?.songId]);

  const runCurrentTask = useCallback(async () => {
    if (!task || !canGenerate) return;
    cancelInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('working');
    setError(null);
    setAppliedNote(null);
    setProposal(null);
    const userText = composeTaskUserText(task, { ...fields, refine });
    try {
      const id = await getAiProvider();
      const byok = await getPreferByok();
      const apiKey = (await getAiApiKey(id)) ?? '';
      const result = await runAiTask({
        taskType: task,
        provider: id,
        apiKey,
        preferByok: byok,
        messages: taskMessages(task, userText, libraryCtx),
        librarySongs: libraryCtx.songs,
        chartConsent: libraryCtx.chartConsent,
        signal: controller.signal,
        allowModelFallback: false,
      });
      setLastTask(result);
      setProposal(result.envelope);
      setPhase('review');
    } catch (err) {
      setError(userFacingAssistError(err, hosted));
      setPhase('setup');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [task, canGenerate, cancelInFlight, fields, refine, libraryCtx, hosted]);

  const onApply = async () => {
    if (!proposal || applying) return;
    setApplying(true);
    setError(null);
    try {
      const receipt = await applyApprovedProposal(proposal, { contentHash: proposal.contentHash });
      setAppliedNote(receipt.summary);
      setCanUndo(Boolean(receipt.undo));
      setProposal(null);
      setPhase('applied');
      await refresh();
      if (lastTask?.proposal?.kind === 'library' && lastTask.proposal.songIds[0]) {
        router.push(`/song/${lastTask.proposal.songIds[0]}` as Href);
      }
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

  const goHome = () => {
    cancelInFlight();
    setPhase('home');
    setTask(null);
    setError(null);
    setProposal(null);
    router.replace('/ai' as Href);
  };

  const card = AI_ACTION_CARDS.find((item) => item.id === task);
  const pickerSongs = useMemo(() => {
    const q = songQuery.trim().toLowerCase();
    const rows = songs.slice(0, 80);
    if (!q) return rows.slice(0, 12);
    return rows.filter((song) => `${song.title} ${song.artist}`.toLowerCase().includes(q)).slice(0, 12);
  }, [songs, songQuery]);

  if (!ready) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{phase === 'home' ? 'Assist' : card?.title ?? 'Assist'}</Text>
          <Text style={styles.sub}>
            {phase === 'home'
              ? hosted
                ? 'Hosted assistant · charts stay on this device until you Apply'
                : preferByok
                  ? 'Your own key · Settings holds provider details'
                  : access
                    ? 'Your own key · Settings holds provider details'
                    : 'Add a key in Settings, or use the hosted assistant'
              : songDisplayName({ title: chartConsent?.title })}
          </Text>
        </View>
        {phase === 'home' ? (
          <Pressable
            onPress={() => router.push('/settings' as Href)}
            style={styles.gear}
            accessibilityLabel="Assistant settings">
            <Ionicons name="settings-outline" size={22} color={theme.accent} />
          </Pressable>
        ) : (
          <Pressable onPress={goHome} style={styles.gear} accessibilityLabel="Close workspace">
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        )}
      </View>

      {phase === 'home' ? (
        <ScrollView contentContainerStyle={styles.homePad}>
          <Text style={styles.homeLead}>What are we preparing?</Text>
          {AI_ACTION_CARDS.map((item) => (
            <TaskCard key={item.id} card={item} onPress={() => openTask(item.id)} />
          ))}
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.workPad} keyboardShouldPersistTaps="handled">
            {chartConsent && task === 'fix-chart' ? (
              <Text style={styles.contextBar}>
                {chartConsent.title}
                {libraryCtx.liveActive ? ' · Live is on stage — Apply stays blocked' : ''}
              </Text>
            ) : null}

            {phase === 'setup' || phase === 'working' ? (
              <SetupFields
                task={task}
                fields={fields}
                setFields={setFields}
                songQuery={songQuery}
                setSongQuery={setSongQuery}
                pickerSongs={pickerSongs}
                chartConsent={chartConsent}
                onPickSong={(song) => {
                  setChartConsent({ songId: song.id, title: song.title, chordpro: song.chordpro ?? '' });
                }}
              />
            ) : null}

            {phase === 'working' ? (
              <View style={styles.workingBox}>
                <ActivityIndicator color={theme.accent} />
                <Text style={styles.workingText}>Working on this draft…</Text>
                <Pressable onPress={cancelInFlight} style={styles.ghost}>
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Assistant is temporarily busy</Text>
                <Text style={styles.errorBody}>
                  Your inputs are saved. No changes have been applied.
                  {'\n'}
                  {error}
                </Text>
                <View style={styles.previewRow}>
                  <Pressable style={styles.ghost} onPress={() => void runCurrentTask()}>
                    <Text style={styles.ghostText}>Try again</Text>
                  </Pressable>
                  <Pressable style={styles.ghost} onPress={goHome}>
                    <Text style={styles.ghostText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {phase === 'review' && proposal ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>{reviewTitle(proposal)}</Text>
                {reviewLines(proposal).map((line) => (
                  <Text key={line} style={styles.previewBody}>
                    {line}
                  </Text>
                ))}
                {proposal.warnings.map((line) => (
                  <Text key={line} style={styles.previewBody}>
                    {line}
                  </Text>
                ))}
                {proposal.body.notes ? (
                  <Text style={styles.previewBody}>{stripInternalPayload(proposal.body.notes)}</Text>
                ) : null}
                {proposal.body.kind === 'set' && proposal.estimatedSeconds ? (
                  <Text style={styles.previewBody}>
                    Known duration {Math.round(proposal.estimatedSeconds / 60)} min
                    {proposal.missingDurationIds.length
                      ? ` · ${proposal.missingDurationIds.length} song(s) missing duration`
                      : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {phase === 'applied' && appliedNote ? <Text style={styles.applied}>{appliedNote}</Text> : null}
            {canUndo ? (
              <Pressable style={styles.ghost} onPress={() => void onUndo()} disabled={applying}>
                <Text style={styles.ghostText}>{applying ? 'Working…' : 'Undo last Apply'}</Text>
              </Pressable>
            ) : null}

            {(phase === 'review' || phase === 'applied') && task ? (
              <View style={styles.refineBox}>
                <Text style={styles.label}>Refine this {task === 'build-set' ? 'set' : 'draft'}</Text>
                <TextInput
                  value={refine}
                  onChangeText={setRefine}
                  placeholder="Keep the first three. Replace the encore."
                  placeholderTextColor={theme.faint}
                  style={styles.input}
                  multiline
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {phase === 'setup' ? (
              <Pressable
                style={[styles.primary, (!canGenerate || !access) && styles.sendDisabled]}
                disabled={!canGenerate || !access}
                onPress={() => void runCurrentTask()}>
                <Text style={styles.primaryText}>{task ? primaryTaskAction(task) : 'Continue'}</Text>
              </Pressable>
            ) : null}
            {phase === 'review' && proposal ? (
              <View style={styles.previewRow}>
                {refine.trim() ? (
                  <Pressable style={styles.ghost} onPress={() => void runCurrentTask()} disabled={applying}>
                    <Text style={styles.ghostText}>Update draft</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.ghost}
                    onPress={() => {
                      setProposal(null);
                      setPhase('setup');
                    }}
                    disabled={applying}>
                    <Text style={styles.ghostText}>Discard</Text>
                  </Pressable>
                )}
                {proposal.body.kind === 'library' ? (
                  <Pressable
                    style={styles.primary}
                    onPress={() => {
                      const first = proposal.body.kind === 'library' ? proposal.body.songIds[0] : undefined;
                      if (first) router.push(`/song/${first}` as Href);
                    }}>
                    <Text style={styles.primaryText}>{primaryActionLabel(proposal)}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.primary} onPress={() => void onApply()} disabled={applying}>
                    <Text style={styles.primaryText}>
                      {applying ? 'Applying…' : primaryActionLabel(proposal)}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {phase === 'applied' ? (
              <Pressable style={styles.primary} onPress={goHome}>
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            ) : null}
            {!access ? (
              <Pressable style={styles.ghost} onPress={() => router.push('/settings' as Href)}>
                <Text style={styles.ghostText}>Open Assistant settings</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function TaskCard({ card, onPress }: { card: AiActionCard; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={card.title}>
      <View style={styles.cardIcon}>
        <Ionicons name={card.icon} size={22} color={theme.accent} />
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardSub}>{card.subtitle}</Text>
        <Text style={styles.cardAction}>{card.action}</Text>
      </View>
    </Pressable>
  );
}

function SetupFields({
  task,
  fields,
  setFields,
  songQuery,
  setSongQuery,
  pickerSongs,
  chartConsent,
  onPickSong,
}: {
  task: AiActionId | null;
  fields: AssistTaskFields;
  setFields: (next: AssistTaskFields | ((prev: AssistTaskFields) => AssistTaskFields)) => void;
  songQuery: string;
  setSongQuery: (value: string) => void;
  pickerSongs: { id: string; title: string; artist: string; chordpro?: string | null }[];
  chartConsent?: LibraryContextStub['chartConsent'];
  onPickSong: (song: { id: string; title: string; chordpro?: string | null }) => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (task === 'build-set') {
    return (
      <View style={styles.form}>
        <Text style={styles.workTitle}>Build your set</Text>
        <Text style={styles.label}>Set name</Text>
        <TextInput
          value={fields.setName ?? ''}
          onChangeText={(setName) => setFields((prev) => ({ ...prev, setName }))}
          placeholder="Friday gig"
          placeholderTextColor={theme.faint}
          style={styles.input}
        />
        <Text style={styles.label}>Song count</Text>
        <TextInput
          value={fields.songCount ?? '8'}
          onChangeText={(songCount) => setFields((prev) => ({ ...prev, songCount }))}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.label}>Song source</Text>
        <View style={styles.chipRow}>
          {(['library', 'favorites'] as const).map((source) => (
            <Pressable
              key={source}
              style={[styles.chip, fields.source === source && styles.chipOn]}
              onPress={() => setFields((prev) => ({ ...prev, source }))}>
              <Text style={styles.chipText}>{source === 'library' ? 'Entire library' : 'Favorites'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Occasion or energy (optional)</Text>
        <TextInput
          value={fields.occasion ?? ''}
          onChangeText={(occasion) => setFields((prev) => ({ ...prev, occasion }))}
          placeholder="Acoustic openers, keep it upbeat"
          placeholderTextColor={theme.faint}
          style={styles.input}
        />
      </View>
    );
  }
  if (task === 'fix-chart') {
    return (
      <View style={styles.form}>
        <Text style={styles.workTitle}>Clean up chart</Text>
        <Text style={styles.hint}>Preserve lyrics is on. Analyze does not overwrite until you Apply.</Text>
        {!chartConsent ? (
          <>
            <Text style={styles.label}>Choose a song</Text>
            <TextInput
              value={songQuery}
              onChangeText={setSongQuery}
              placeholder="Search your library"
              placeholderTextColor={theme.faint}
              style={styles.input}
            />
            {pickerSongs.map((song) => (
              <Pressable key={song.id} style={styles.pickRow} onPress={() => onPickSong(song)}>
                <Text style={styles.cardTitle}>{songDisplayName(song)}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={styles.contextBar}>{chartConsent.title} is attached.</Text>
        )}
        <Text style={styles.label}>Anything to leave alone?</Text>
        <TextInput
          value={fields.leaveAlone ?? ''}
          onChangeText={(leaveAlone) => setFields((prev) => ({ ...prev, leaveAlone }))}
          placeholder="Keep the section named Bridge 2"
          placeholderTextColor={theme.faint}
          style={styles.input}
        />
      </View>
    );
  }
  if (task === 'clean-import') {
    return (
      <View style={styles.form}>
        <Text style={styles.workTitle}>From text</Text>
        <Text style={styles.hint}>Paste lyrics or a chart. Create preview stays off until there is text.</Text>
        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          value={fields.title ?? ''}
          onChangeText={(title) => setFields((prev) => ({ ...prev, title }))}
          placeholder="Song title"
          placeholderTextColor={theme.faint}
          style={styles.input}
        />
        <Text style={styles.label}>Artist (optional)</Text>
        <TextInput
          value={fields.artist ?? ''}
          onChangeText={(artist) => setFields((prev) => ({ ...prev, artist }))}
          placeholder="Artist"
          placeholderTextColor={theme.faint}
          style={styles.input}
        />
        <Pressable
          style={[styles.chip, fields.hasChords && styles.chipOn]}
          onPress={() => setFields((prev) => ({ ...prev, hasChords: !prev.hasChords }))}>
          <Text style={styles.chipText}>Text already contains chords</Text>
        </Pressable>
        <Text style={styles.label}>Text</Text>
        <TextInput
          value={fields.paste ?? ''}
          onChangeText={(paste) => setFields((prev) => ({ ...prev, paste }))}
          placeholder="Paste lyrics or ChordPro here"
          placeholderTextColor={theme.faint}
          style={[styles.input, styles.paste]}
          multiline
        />
      </View>
    );
  }
  return (
    <View style={styles.form}>
      <Text style={styles.workTitle}>Explore your library</Text>
      <Text style={styles.label}>What are you looking for?</Text>
      <TextInput
        value={fields.query ?? ''}
        onChangeText={(query) => setFields((prev) => ({ ...prev, query }))}
        placeholder="Acoustic openers I haven't used lately"
        placeholderTextColor={theme.faint}
        style={[styles.input, styles.paste]}
        multiline
      />
    </View>
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
      paddingBottom: 8,
      gap: 12,
    },
    headerCopy: { flex: 1 },
    title: { color: t.text, fontSize: 22, fontWeight: '700' as const },
    sub: { color: t.muted, marginTop: 2, fontSize: 13, lineHeight: 18 },
    gear: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
    },
    homePad: { padding: 16, paddingBottom: 40, gap: 12 },
    homeLead: { color: t.text, fontSize: 20, fontWeight: '700' as const, marginBottom: 4 },
    card: {
      flexDirection: 'row' as const,
      gap: 12,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      minHeight: 88,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.border,
    },
    cardCopy: { flex: 1 },
    cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    cardSub: { color: t.muted, marginTop: 4, fontSize: 14, lineHeight: 20 },
    cardAction: { color: t.accent, marginTop: 8, fontWeight: '700' as const, fontSize: 13 },
    workPad: { padding: 16, paddingBottom: 24, gap: 12 },
    form: { gap: 8 },
    workTitle: { color: t.text, fontSize: 20, fontWeight: '700' as const, marginBottom: 4 },
    hint: { color: t.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    label: { color: t.text, fontWeight: '600' as const, fontSize: 14, marginTop: 4 },
    input: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
    },
    paste: { minHeight: 140, textAlignVertical: 'top' as const },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.panel,
    },
    chipOn: { borderColor: t.accent },
    chipText: { color: t.text, fontWeight: '600' as const, fontSize: 13 },
    pickRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    contextBar: { color: t.muted, fontSize: 13, lineHeight: 18 },
    workingBox: { alignItems: 'center' as const, gap: 12, paddingVertical: 16 },
    workingText: { color: t.muted, fontSize: 14 },
    errorCard: {
      padding: 16,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      gap: 8,
    },
    errorTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    errorBody: { color: t.muted, fontSize: 14, lineHeight: 20 },
    preview: {
      padding: 16,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.accent,
      backgroundColor: t.panel,
      gap: 8,
    },
    previewTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    previewBody: { color: t.muted, fontSize: 14, lineHeight: 20 },
    previewRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10, flexWrap: 'wrap' as const },
    refineBox: { gap: 8 },
    applied: { color: t.muted, fontSize: 14, lineHeight: 20 },
    bottomBar: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.bg,
      gap: 8,
    },
    primary: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: t.accent,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 16,
    },
    primaryText: { color: t.accentText, fontWeight: '700' as const, fontSize: 16 },
    ghost: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    ghostText: { color: t.text, fontWeight: '600' as const },
    sendDisabled: { opacity: 0.4 },
  };
}
