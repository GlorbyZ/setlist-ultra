import { createHostedClient, type HostedChart } from '@setlist-ultra/api';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  EMPTY_SYNC_PROGRESS,
  isArrangementConflict,
  shouldApplyRemoteSetItems,
  shouldPushEntity,
  type SyncProgressEvent,
} from '@setlist-ultra/core';
import { config, isHostedConfigured } from './config';
import { authStorage } from './authStorage';
import {
  createOrg,
  deleteSetlist,
  deleteSong,
  findChartByHash,
  findOrCreateChart,
  getLibraryScope,
  getSetlistItems,
  getSyncState,
  insertLibrarySong,
  listOrgs,
  listSetlistsForSync,
  listSongsForSync,
  newId,
  now,
  saveSyncState,
  touchLastSync,
  updateSong,
} from './repository';
import { getDatabase } from './db';
import {
  completeOutboxForEntity,
  getSyncCheckpoint,
  insertChartRevision,
  listPendingOutbox,
  saveSyncCheckpoint,
  workspaceIdForScope,
} from './domain';
import { orgs, setlistItems, setlists } from '@setlist-ultra/db';
import { eq } from 'drizzle-orm';

WebBrowser.maybeCompleteAuthSession();

let client: ReturnType<typeof createHostedClient> | null = null;
let restoreAttempted = false;
/** Settings owns Google OAuth UI; callback route should not steal navigation. */
let oauthOwnedBySettings = false;
let inflightCodeExchange: { key: string; promise: Promise<HostedAuthSession> } | null = null;

type HostedAuthSession = {
  access_token: string;
  refresh_token: string;
  user: { email?: string | null };
};

export function isOAuthOwnedBySettings() {
  return oauthOwnedBySettings;
}

/** Deep-link redirect for Supabase OAuth. Must be allow-listed in the dashboard. */
export function getAuthRedirectUri() {
  return makeRedirectUri({
    scheme: 'setlistultra',
    path: 'auth/callback',
  });
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(config.googleWebClientId.trim());
}

export function getHostedClient() {
  if (!isHostedConfigured()) return null;
  if (!client) {
    client = createHostedClient(config.supabaseUrl, config.supabaseAnonKey, {
      storage: authStorage,
      detectSessionInUrl: false,
      flowType: 'pkce',
    });
  }
  return client;
}

function hostedError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object') {
    const row = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [row.message, row.details, row.hint, row.code].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    if (parts.length) return new Error(parts.join(' · '));
  }
  return new Error('Sync failed.');
}

function blankToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseAst(raw?: string | null) {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isUuid(value?: string | null): value is string {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

async function persistSupabaseSession(email?: string | null, accessToken?: string | null, refreshToken?: string | null) {
  await saveSyncState({
    provider: 'supabase',
    accountEmail: email === undefined ? undefined : email,
    accessToken: accessToken === undefined ? undefined : accessToken,
    refreshToken: refreshToken === undefined ? undefined : refreshToken,
  });
}

async function restoreSessionIfNeeded() {
  const supabase = getHostedClient();
  if (!supabase || restoreAttempted) return;
  restoreAttempted = true;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const state = await getSyncState();
  if (state?.provider !== 'supabase' || !state.accessToken || !state.refreshToken) return;
  const { error } = await supabase.auth.setSession({
    access_token: state.accessToken,
    refresh_token: state.refreshToken,
  });
  if (error) {
    // Stale local tokens — fall back to signed-out.
    await saveSyncState({
      provider: 'local',
      accountEmail: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
    });
  }
}

export async function hostedSignIn(email: string, password: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured. Add EXPO_PUBLIC_SUPABASE_URL and ANON key.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw hostedError(error);
  await persistSupabaseSession(email, data.session?.access_token, data.session?.refresh_token);
  return data.user;
}

export async function hostedSignUp(email: string, password: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw hostedError(error);
  if (data.session) {
    await persistSupabaseSession(email, data.session.access_token, data.session.refresh_token);
  }
  return data.user;
}

/**
 * Google via Supabase Auth OAuth (browser + deep link).
 * Uses the Web client ID configured in Supabase Auth → Google (same value as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
 * Native Android client ID is optional for this flow; needed later for Google Sign-In SDK / Drive.
 */
export async function hostedSignInWithGoogle() {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured. Add EXPO_PUBLIC_SUPABASE_URL and ANON key.');
  if (!isGoogleAuthConfigured()) {
    throw new Error('Google sign-in needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and the same Client ID in Supabase Auth → Google).');
  }

  oauthOwnedBySettings = true;
  try {
    const redirectTo = getAuthRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) throw hostedError(error);
    if (!data.url) throw new Error('Could not start Google sign-in.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      return completeOAuthFromUrl(result.url);
    }

    // Android Custom Tabs often deliver the code via deep link and then dismiss.
    const existing = await waitForHostedSession(2500);
    if (existing) {
      await persistSupabaseSession(existing.user.email, existing.access_token, existing.refresh_token);
      return existing.user;
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Google sign-in cancelled.');
    }
    throw new Error('Google sign-in did not complete.');
  } finally {
    oauthOwnedBySettings = false;
  }
}

/** Complete OAuth from a deep-link / auth-session URL (callback route or openAuthSessionAsync). */
export async function completeOAuthFromUrl(url: string) {
  const session = await createSessionFromUrl(url);
  if (!session) throw new Error('Sign-in returned no session. Try again from Settings.');
  await persistSupabaseSession(session.user.email, session.access_token, session.refresh_token);
  return session.user;
}

async function createSessionFromUrl(url: string) {
  const supabase = getHostedClient();
  if (!supabase) return null;

  const parsed = parseAuthCallbackUrl(url);
  if (parsed.error) throw new Error(parsed.error);

  const exchangeKey = parsed.code ?? parsed.accessToken ?? url;
  if (inflightCodeExchange?.key === exchangeKey) return inflightCodeExchange.promise;

  const promise = (async (): Promise<HostedAuthSession> => {
    if (parsed.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        parsed.code,
        parsed.flowId ? { flowId: parsed.flowId } : undefined,
      );
      if (error) {
        const recovered = await recoverSessionAfterOauthError(error);
        if (recovered) return recovered;
        throw hostedError(error);
      }
      if (!data.session) throw new Error('Sign-in returned no session. Try again from Settings.');
      return data.session;
    }

    if (parsed.accessToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken ?? '',
      });
      if (error) throw hostedError(error);
      if (!data.session) throw new Error('Sign-in returned no session. Try again from Settings.');
      return data.session;
    }

    const existing = await currentHostedSession();
    if (existing) return existing;
    throw new Error('Sign-in returned no session. Try again from Settings.');
  })();

  inflightCodeExchange = { key: exchangeKey, promise };
  try {
    return await promise;
  } finally {
    if (inflightCodeExchange?.promise === promise) inflightCodeExchange = null;
  }
}

function parseAuthCallbackUrl(url: string) {
  const params: Record<string, string> = {};
  const collect = (source: Record<string, string | string[] | undefined> | URLSearchParams | undefined) => {
    if (!source) return;
    if (source instanceof URLSearchParams) {
      source.forEach((value, key) => {
        if (value) params[key] = value;
      });
      return;
    }
    for (const [key, value] of Object.entries(source)) {
      const raw = Array.isArray(value) ? value[0] : value;
      if (typeof raw === 'string' && raw) params[key] = raw;
    }
  };

  try {
    const parsed = new URL(url);
    collect(parsed.searchParams);
    if (parsed.hash.length > 1) collect(new URLSearchParams(parsed.hash.slice(1)));
  } catch {
    /* custom schemes can fail URL parsing on some engines */
  }

  const fromExpo = QueryParams.getQueryParams(url);
  collect(fromExpo.params as Record<string, string | undefined>);
  collect(Linking.parse(url).queryParams as Record<string, string | string[] | undefined>);

  const error =
    (typeof fromExpo.errorCode === 'string' && fromExpo.errorCode) ||
    params.error_description ||
    params.error ||
    undefined;

  return {
    code: params.code,
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    flowId: params.sb_flow_id,
    error,
  };
}

function isConsumedOauthError(error: unknown) {
  const text = error instanceof Error ? error.message : hostedError(error).message;
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  return /flow state/i.test(text) || /code verifier/i.test(text) || /flow_state/i.test(code);
}

async function currentHostedSession(): Promise<HostedAuthSession | null> {
  const supabase = getHostedClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.refresh_token) return null;
  return session;
}

async function waitForHostedSession(ms: number) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const session = await currentHostedSession();
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return currentHostedSession();
}

async function recoverSessionAfterOauthError(error: unknown) {
  if (!isConsumedOauthError(error)) return null;
  return waitForHostedSession(1200);
}

export async function hostedSignOut() {
  const supabase = getHostedClient();
  await supabase?.auth.signOut();
  await saveSyncState({
    provider: 'local',
    accountEmail: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
  });
}

export async function hostedSessionEmail(): Promise<string | null> {
  const supabase = getHostedClient();
  if (!supabase) return null;
  await restoreSessionIfNeeded();
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function lookupRemoteChart(contentHash: string, sourceProvider?: string, sourceExternalId?: string) {
  const supabase = getHostedClient();
  if (!supabase) return null;

  const provider = blankToNull(sourceProvider);
  const externalId = blankToNull(sourceExternalId);
  if (provider && externalId) {
    const bySource = await supabase
      .from('charts')
      .select('*')
      .eq('source_provider', provider)
      .eq('source_external_id', externalId)
      .maybeSingle();
    if (bySource.error && bySource.error.code !== 'PGRST116') throw hostedError(bySource.error);
    if (bySource.data) return bySource.data as HostedChart;
  }

  const byHash = await supabase.from('charts').select('*').eq('content_hash', contentHash).maybeSingle();
  if (byHash.error && byHash.error.code !== 'PGRST116') throw hostedError(byHash.error);
  return (byHash.data as HostedChart | null) ?? null;
}

export async function pushChartToHost(input: {
  contentHash: string;
  chordpro: string;
  ast?: string;
  title?: string;
  artist?: string;
  originalKey?: string;
  sourceProvider?: string | null;
  sourceExternalId?: string | null;
}) {
  const supabase = getHostedClient();
  if (!supabase) return null;
  const sourceProvider = blankToNull(input.sourceProvider);
  const sourceExternalId = blankToNull(input.sourceExternalId);
  const existing = await lookupRemoteChart(input.contentHash, sourceProvider ?? undefined, sourceExternalId ?? undefined);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('charts')
    .insert({
      content_hash: input.contentHash,
      chordpro: input.chordpro,
      ast: parseAst(input.ast),
      title: input.title ?? null,
      artist: input.artist ?? null,
      original_key: input.originalKey ?? null,
      source_provider: sourceProvider,
      source_external_id: sourceExternalId,
    })
    .select('*')
    .maybeSingle();
  if (error) {
    const again = await lookupRemoteChart(input.contentHash, sourceProvider ?? undefined, sourceExternalId ?? undefined);
    if (again) return again;
    throw hostedError(error);
  }
  return data as HostedChart;
}

type RemoteLibraryRow = {
  id: string;
  title: string;
  artist: string;
  capo?: number | null;
  key_shift?: number | null;
  duration_seconds?: number | null;
  deleted_at?: string | null;
  updated_at?: string | null;
  revision?: number | null;
  extras?: Record<string, unknown> | null;
  charts?: HostedChart | null;
};

type RemoteSetRow = {
  id: string;
  title: string;
  event_date?: string | null;
  deleted_at?: string | null;
  updated_at?: string | null;
  extras?: { localId?: string; notes?: string; pinned?: number } | null;
  setlist_items?: {
    library_item_id?: string | null;
    sort_order?: number;
    key_offset?: number;
    extras?: { itemType?: string; noteContent?: string; timerSeconds?: number; overrideCapo?: number | null };
  }[];
};

function laterCursor(current: string | null, candidate?: string | null) {
  if (!candidate) return current;
  if (!current || candidate > current) return candidate;
  return current;
}

async function claimSyncOp(
  supabase: NonNullable<ReturnType<typeof getHostedClient>>,
  operationId: string,
  entityType: string,
  entityId: string,
) {
  if (!isUuid(operationId)) return true;
  const { data, error } = await supabase.rpc('claim_sync_op', {
    p_id: operationId,
    p_entity_type: entityType,
    p_entity_id: entityId,
  });
  if (error) throw hostedError(error);
  return data === true;
}

function outboxIdFor(pending: { id: string; entityId: string }[], entityId: string) {
  const match = [...pending].reverse().find((row) => row.entityId === entityId);
  return isUuid(match?.id) ? match.id : newId();
}

async function upsertLibraryItem(
  supabase: NonNullable<ReturnType<typeof getHostedClient>>,
  input: {
    remoteId?: string | null;
    userId: string | null;
    orgId: string | null;
    chartId: string;
    title: string;
    artist: string;
    capo: number | null;
    keyShift: number | null;
    durationSeconds: number | null;
    extras: Record<string, unknown>;
    deletedAt?: string | null;
    revision?: number;
    operationId: string;
  },
) {
  const claimed = await claimSyncOp(supabase, input.operationId, 'library_item', input.remoteId ?? input.operationId);
  const payload = {
    user_id: input.userId,
    org_id: input.orgId,
    chart_id: input.chartId,
    title: input.title,
    artist: input.artist,
    capo: input.capo,
    key_shift: input.keyShift,
    duration_seconds: input.durationSeconds,
    extras: input.extras,
    deleted_at: input.deletedAt ?? null,
    revision: input.revision ?? 1,
    updated_at: now(),
  };

  let existingId: string | null = isUuid(input.remoteId) ? input.remoteId : null;
  if (!existingId) {
    let query = supabase.from('library_items').select('id').eq('chart_id', input.chartId);
    query = input.orgId ? query.eq('org_id', input.orgId) : query.eq('user_id', input.userId);
    const found = await query.maybeSingle();
    if (found.error && found.error.code !== 'PGRST116') throw hostedError(found.error);
    existingId = found.data?.id ?? null;
  }

  if (!claimed && existingId) return existingId;

  if (existingId) {
    const { error } = await supabase.from('library_items').update(payload).eq('id', existingId);
    if (error) throw hostedError(error);
    return existingId;
  }

  const inserted = await supabase.from('library_items').insert(payload).select('id').maybeSingle();
  if (inserted.error) throw hostedError(inserted.error);
  if (!inserted.data?.id) throw new Error('Cloud library row was not created.');
  return inserted.data.id as string;
}

function createSyncReporter(onProgress?: (event: SyncProgressEvent) => void) {
  const state: SyncProgressEvent = { ...EMPTY_SYNC_PROGRESS };
  const emit = (patch: Partial<SyncProgressEvent> = {}) => {
    Object.assign(state, patch);
    onProgress?.({ ...state });
  };
  const addTotal = (count: number) => {
    if (count > 0) emit({ total: state.total + count });
  };
  const tick = (patch: Partial<SyncProgressEvent> = {}) => {
    emit({ ...patch, done: state.done + 1 });
  };
  const finish = () => {
    const total = Math.max(state.total, state.done, 1);
    emit({ phase: 'done', done: total, total });
  };
  return { state, emit, addTotal, tick, finish };
}

export async function syncPersonalLibrary(onProgress?: (event: SyncProgressEvent) => void) {
  const progress = createSyncReporter(onProgress);
  progress.emit({ phase: 'session' });

  const supabase = getHostedClient();
  if (!supabase) throw new Error('Sign in to hosted sync first.');
  await restoreSessionIfNeeded();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Not signed in.');

  const scope = await getLibraryScope();
  const workspaceId = workspaceIdForScope(scope);
  const pending = await listPendingOutbox(workspaceId);
  const localSongs = await listSongsForSync(scope);
  const localSets = await listSetlistsForSync(scope);
  const libraryIdBySong = new Map<string, string>();
  const userId = scope.libraryKind === 'personal' ? user.id : null;
  const orgId = scope.libraryKind === 'org' ? (scope.orgId ?? null) : null;

  const songsToPush = localSongs.filter((song) => shouldPushEntity(song.syncStatus, song.deleted));
  const setsToPush = localSets.filter((set) => shouldPushEntity(set.syncStatus, set.deleted));
  progress.emit({
    phase: songsToPush.length ? 'push-songs' : 'pull-songs',
    skippedSongs: localSongs.length - songsToPush.length,
  });
  progress.addTotal(songsToPush.length + setsToPush.length);

  for (const song of localSongs) {
    if (isUuid(song.remoteId)) libraryIdBySong.set(song.id, song.remoteId);
    if (!shouldPushEntity(song.syncStatus, song.deleted)) continue;

    try {
      const operationId = outboxIdFor(pending, song.id);
      if (song.deleted) {
        if (!isUuid(song.remoteId)) {
          await updateSong(song.id, { syncStatus: 'synced' }, { origin: 'sync' });
          await completeOutboxForEntity(song.id);
          continue;
        }
        const claimed = await claimSyncOp(supabase, operationId, 'library_item', song.remoteId);
        if (claimed) {
          const { error } = await supabase
            .from('library_items')
            .update({ deleted_at: now(), revision: song.localRevision ?? 1, updated_at: now() })
            .eq('id', song.remoteId);
          if (error) throw hostedError(error);
        }
        await updateSong(song.id, { syncStatus: 'synced' }, { origin: 'sync' });
        await completeOutboxForEntity(song.id);
        continue;
      }

      if (!song.contentHash) continue;
      const remoteChart = await pushChartToHost({
        contentHash: song.contentHash,
        chordpro: song.chordpro,
        ast: song.contentAst,
        title: song.title,
        artist: song.artist,
        originalKey: song.originalKey ?? undefined,
        sourceProvider: song.sourceProvider,
        sourceExternalId: song.sourceUrl,
      });
      if (!remoteChart) continue;

      const remoteLibraryId = await upsertLibraryItem(supabase, {
        remoteId: song.remoteId,
        userId,
        orgId,
        chartId: remoteChart.id,
        title: song.title,
        artist: song.artist,
        capo: song.capo,
        keyShift: song.keyShift,
        durationSeconds: song.durationSeconds ?? null,
        extras: {
          notesText: song.notesText,
          tags: song.tags,
          syncId: song.syncId,
          sbpId: song.sbpId,
          localId: song.id,
          autoscrollSeconds: song.duration2 ?? null,
          keyShift: song.keyShift,
        },
        deletedAt: null,
        revision: song.localRevision ?? 1,
        operationId,
      });
      libraryIdBySong.set(song.id, remoteLibraryId);
      await updateSong(song.id, { remoteId: remoteLibraryId, syncStatus: 'synced' }, { origin: 'sync' });
      await completeOutboxForEntity(song.id);
    } finally {
      progress.tick({ phase: 'push-songs', pushedSongs: progress.state.pushedSongs + 1 });
    }
  }

  const checkpoint = await getSyncCheckpoint(workspaceId);
  let libraryQuery = orgId
    ? supabase.from('library_items').select('*, charts(*)').eq('org_id', orgId)
    : supabase.from('library_items').select('*, charts(*)').eq('user_id', user.id);
  if (checkpoint?.cursor) libraryQuery = libraryQuery.gt('updated_at', checkpoint.cursor);

  const { data: remoteItems, error } = await libraryQuery;
  if (error) throw hostedError(error);

  const remoteSongRows = (remoteItems ?? []) as RemoteLibraryRow[];
  progress.emit({ phase: 'pull-songs' });
  progress.addTotal(remoteSongRows.length);

  const refreshedSongs = await listSongsForSync(scope);
  let pullCursor = checkpoint?.cursor ?? null;
  for (const item of remoteSongRows) {
    try {
      pullCursor = laterCursor(pullCursor, item.updated_at);
      const chart = item.charts;
      const extras = (item.extras ?? {}) as { autoscrollSeconds?: number | null; notesText?: string; tags?: string };
      const existing = refreshedSongs.find((s) => s.remoteId === item.id || (!item.deleted_at && s.contentHash && s.contentHash === chart?.content_hash));

      if (item.deleted_at) {
        if (existing && !shouldPushEntity(existing.syncStatus, existing.deleted)) {
          await deleteSong(existing.id, { origin: 'sync' });
        }
        continue;
      }
      if (!chart?.chordpro) continue;

      const astJson = typeof chart.ast === 'string' ? chart.ast : chart.ast ? JSON.stringify(chart.ast) : undefined;
      await findOrCreateChart({
        chordpro: chart.chordpro,
        ast: astJson,
        title: chart.title ?? item.title,
        artist: chart.artist ?? item.artist,
        originalKey: chart.original_key ?? undefined,
        contentHash: chart.content_hash,
        sourceProvider: chart.source_provider,
        sourceExternalId: chart.source_external_id,
      });

      if (existing) {
        libraryIdBySong.set(existing.id, item.id);
        const localDirty = shouldPushEntity(existing.syncStatus, existing.deleted);
        if (isArrangementConflict(localDirty, existing.contentHash, chart.content_hash)) {
          await insertChartRevision({
            arrangementId: existing.id,
            contentHash: chart.content_hash,
            chordpro: chart.chordpro,
            ast: astJson,
            parentRevisionId: existing.revisionId,
          });
          if (existing.remoteId !== item.id) {
            await updateSong(existing.id, { remoteId: item.id }, { origin: 'sync' });
          }
          progress.emit({ conflicts: progress.state.conflicts + 1 });
          continue;
        }
        await updateSong(
          existing.id,
          {
            remoteId: item.id,
            syncStatus: localDirty ? existing.syncStatus : 'synced',
            capo: item.capo ?? existing.capo ?? 0,
            keyShift: item.key_shift ?? existing.keyShift ?? 0,
            durationSeconds: item.duration_seconds ?? existing.durationSeconds ?? undefined,
            duration2: extras.autoscrollSeconds ?? existing.duration2 ?? undefined,
            originalKey: chart.original_key ?? existing.originalKey ?? undefined,
            chordpro: localDirty ? undefined : chart.chordpro,
            notesText: extras.notesText ?? existing.notesText ?? undefined,
            tags: extras.tags ?? existing.tags ?? undefined,
          },
          { origin: 'sync' },
        );
        continue;
      }

      const localId = await insertLibrarySong({
        title: item.title,
        artist: item.artist,
        capo: item.capo ?? 0,
        chordpro: chart.chordpro,
        originalKey: chart.original_key ?? undefined,
        sourceProvider: chart.source_provider,
        sourceExternalId: chart.source_external_id ?? undefined,
        scope,
        softDedupe: false,
      });
      await updateSong(
        localId,
        {
          remoteId: item.id,
          syncStatus: 'synced',
          keyShift: item.key_shift ?? 0,
          durationSeconds: item.duration_seconds ?? undefined,
          duration2: extras.autoscrollSeconds ?? undefined,
        },
        { origin: 'sync' },
      );
      libraryIdBySong.set(localId, item.id);
      progress.emit({ pulledSongs: progress.state.pulledSongs + 1 });
    } finally {
      progress.tick({ phase: 'pull-songs' });
    }
  }

  await syncSetlists(supabase, {
    userId: user.id,
    scope,
    orgId,
    libraryIdBySong,
    pending,
    checkpointCursor: checkpoint?.cursor ?? null,
    progress,
    onCursor: (value) => {
      pullCursor = laterCursor(pullCursor, value);
    },
  });

  if (pullCursor) await saveSyncCheckpoint(workspaceId, pullCursor, user.id);
  await saveSyncState({
    provider: 'supabase',
    accountEmail: user.email ?? undefined,
  });
  await touchLastSync();
  progress.finish();
}

async function syncSetlists(
  supabase: NonNullable<ReturnType<typeof getHostedClient>>,
  input: {
    userId: string;
    scope: Awaited<ReturnType<typeof getLibraryScope>>;
    orgId: string | null;
    libraryIdBySong: Map<string, string>;
    pending: { id: string; entityId: string }[];
    checkpointCursor: string | null;
    progress: ReturnType<typeof createSyncReporter>;
    onCursor: (value?: string | null) => void;
  },
) {
  const db = await getDatabase();
  const localSets = await listSetlistsForSync(input.scope);
  input.progress.emit({ phase: 'push-sets' });

  for (const set of localSets) {
    if (!shouldPushEntity(set.syncStatus, set.deleted)) {
      if (isUuid(set.remoteId)) {
        /* identity already mapped via remoteId */
      }
      continue;
    }

    try {
    const operationId = outboxIdFor(input.pending, set.id);
    let remoteSetId = isUuid(set.remoteId) ? set.remoteId : null;

    if (set.deleted) {
      if (!remoteSetId) {
        await db.update(setlists).set({ syncStatus: 'synced' }).where(eq(setlists.id, set.id));
        await completeOutboxForEntity(set.id);
        continue;
      }
      const claimed = await claimSyncOp(supabase, operationId, 'setlist', remoteSetId);
      if (claimed) {
        const { error } = await supabase
          .from('setlists')
          .update({ deleted_at: now(), revision: set.localRevision ?? 1, updated_at: now() })
          .eq('id', remoteSetId);
        if (error) throw hostedError(error);
      }
      await db.update(setlists).set({ syncStatus: 'synced', updatedAt: now() }).where(eq(setlists.id, set.id));
      await completeOutboxForEntity(set.id);
      continue;
    }

    const payload = {
      user_id: input.orgId ? null : input.userId,
      org_id: input.orgId,
      title: set.title,
      event_date: set.eventDate || null,
      extras: {
        syncId: set.syncId,
        localId: set.id,
        notes: set.notes,
        pinned: set.pinned,
      },
      deleted_at: null,
      revision: set.localRevision ?? 1,
      updated_at: now(),
    };

    const claimed = await claimSyncOp(supabase, operationId, 'setlist', remoteSetId ?? operationId);
    let createdThisSync = false;
    if (remoteSetId) {
      if (!claimed) {
        await db.update(setlists).set({ syncStatus: 'synced', updatedAt: now() }).where(eq(setlists.id, set.id));
        await completeOutboxForEntity(set.id);
        continue;
      }
      const { error } = await supabase.from('setlists').update(payload).eq('id', remoteSetId);
      if (error) throw hostedError(error);
    } else {
      const inserted = await supabase.from('setlists').insert(payload).select('id').maybeSingle();
      if (inserted.error) throw hostedError(inserted.error);
      remoteSetId = inserted.data?.id ?? null;
      if (!remoteSetId) throw new Error('Cloud setlist was not created.');
      createdThisSync = true;
      await db.update(setlists).set({ remoteId: remoteSetId, updatedAt: now() }).where(eq(setlists.id, set.id));
    }

    const items = await getSetlistItems(set.id);
    const rows = items.map((item, index) => {
      const libraryItemId = item.songId ? input.libraryIdBySong.get(item.songId) ?? null : null;
      return {
        library_item_id: isUuid(libraryItemId) ? libraryItemId : null,
        sort_order: item.sortOrder ?? index,
        key_offset: item.keyOffset ?? 0,
        extras: {
          itemType: item.itemType,
          noteContent: item.noteContent,
          timerSeconds: item.timerSeconds,
          overrideCapo: item.overrideCapo,
          localId: item.id,
        },
      };
    });
    const { error: replaceError } = await supabase.rpc('replace_setlist_items', {
      p_setlist_id: remoteSetId,
      p_items: rows,
    });
    if (replaceError) {
      if (createdThisSync) {
        await supabase.from('setlists').delete().eq('id', remoteSetId);
        await db
          .update(setlists)
          .set({ remoteId: null, syncStatus: 'local', updatedAt: now() })
          .where(eq(setlists.id, set.id));
      }
      throw hostedError(replaceError);
    }
    await db
      .update(setlists)
      .set({ remoteId: remoteSetId, syncStatus: 'synced', updatedAt: now() })
      .where(eq(setlists.id, set.id));
    await completeOutboxForEntity(set.id);
    } finally {
      input.progress.tick({ phase: 'push-sets', pushedSets: input.progress.state.pushedSets + 1 });
    }
  }

  let remoteSetsQuery = input.orgId
    ? supabase.from('setlists').select('*, setlist_items(*)').eq('org_id', input.orgId)
    : supabase.from('setlists').select('*, setlist_items(*)').eq('user_id', input.userId);
  if (input.checkpointCursor) remoteSetsQuery = remoteSetsQuery.gt('updated_at', input.checkpointCursor);
  const { data: remoteSets, error } = await remoteSetsQuery;
  if (error) throw hostedError(error);

  const remoteSetRows = (remoteSets ?? []) as RemoteSetRow[];
  input.progress.emit({ phase: 'pull-sets' });
  input.progress.addTotal(remoteSetRows.length);

  const songByRemoteLibraryId = new Map<string, string>();
  for (const [localId, remoteId] of input.libraryIdBySong) songByRemoteLibraryId.set(remoteId, localId);

  const refreshed = await listSetlistsForSync(input.scope);
  for (const remote of remoteSetRows) {
    try {
      input.onCursor(remote.updated_at);
      const extras = (remote.extras ?? {}) as { localId?: string; notes?: string; pinned?: number };
      const existing = refreshed.find((set) => set.remoteId === remote.id || set.id === extras.localId);

      if (remote.deleted_at) {
        if (existing && shouldApplyRemoteSetItems(existing.syncStatus) && !existing.deleted) {
          await deleteSetlist(existing.id, { origin: 'sync' });
        }
        continue;
      }

      let localSetId = existing?.id;
      let created = false;
      if (!localSetId) {
        localSetId = newId();
        created = true;
        await db.insert(setlists).values({
          id: localSetId,
          libraryKind: input.scope.libraryKind,
          orgId: input.scope.orgId ?? null,
          workspaceId: workspaceIdForScope(input.scope),
          localRevision: 1,
          remoteId: remote.id,
          title: remote.title,
          eventDate: remote.event_date ?? now().slice(0, 10),
          notes: extras.notes ?? null,
          pinned: extras.pinned ? 1 : 0,
          syncStatus: 'synced',
          createdAt: now(),
          updatedAt: now(),
        });
      } else if (existing && shouldApplyRemoteSetItems(existing.syncStatus)) {
        await db
          .update(setlists)
          .set({
            remoteId: remote.id,
            title: remote.title,
            eventDate: remote.event_date ?? existing.eventDate,
            notes: extras.notes ?? existing.notes,
            syncStatus: 'synced',
            updatedAt: now(),
          })
          .where(eq(setlists.id, localSetId));
      } else if (existing?.remoteId !== remote.id) {
        await db.update(setlists).set({ remoteId: remote.id, updatedAt: now() }).where(eq(setlists.id, localSetId));
      }

      const applyItems = !existing || shouldApplyRemoteSetItems(existing.syncStatus);
      if (!applyItems || !localSetId) continue;

      const remoteItems = remote.setlist_items ?? [];
      await db.update(setlistItems).set({ deleted: 1 }).where(eq(setlistItems.setlistId, localSetId));
      for (const [index, item] of remoteItems.entries()) {
        await db.insert(setlistItems).values({
          id: newId(),
          setlistId: localSetId,
          sortOrder: item.sort_order ?? index,
          itemType: item.extras?.itemType === 'note' ? 'note' : item.extras?.itemType === 'timer' ? 'timer' : 'song',
          songId: item.library_item_id ? songByRemoteLibraryId.get(item.library_item_id) ?? null : null,
          noteContent: item.extras?.noteContent ?? null,
          timerSeconds: item.extras?.timerSeconds ?? null,
          keyOffset: item.key_offset ?? 0,
          overrideCapo: item.extras?.overrideCapo ?? null,
        });
      }
      if (created) input.progress.emit({ pulledSets: input.progress.state.pulledSets + 1 });
    } finally {
      input.progress.tick({ phase: 'pull-sets' });
    }
  }
}

export async function syncOrgFromHost(inviteCode: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  await restoreSessionIfNeeded();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const { data: org, error } = await supabase.from('orgs').select('*').eq('invite_code', inviteCode).maybeSingle();
  if (error) throw hostedError(error);
  if (!org) throw new Error('Invite not found');

  await supabase.from('org_members').upsert({
    org_id: org.id,
    user_id: userData.user.id,
    role: 'member',
  });

  const db = await getDatabase();
  const existing = await listOrgs();
  const local = existing.find((o) => o.remoteId === org.id);
  if (!local) {
    await db.insert(orgs).values({
      id: newId(),
      remoteId: org.id,
      name: org.name,
      inviteCode: org.invite_code,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  return org;
}

export async function createHostedOrg(name: string) {
  const supabase = getHostedClient();
  const local = await createOrg(name);
  if (!supabase) return local;
  await restoreSessionIfNeeded();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return local;
  const { data, error } = await supabase
    .from('orgs')
    .insert({ name, invite_code: local.inviteCode, created_by: userData.user.id })
    .select('*')
    .maybeSingle();
  if (error) return local;
  if (data) {
    await supabase.from('org_members').insert({
      org_id: data.id,
      user_id: userData.user.id,
      role: 'owner',
    });
    const db = await getDatabase();
    await db.update(orgs).set({ remoteId: data.id }).where(eq(orgs.id, local.id));
  }
  return local;
}

export async function listHostedMembers(remoteOrgId: string) {
  const supabase = getHostedClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', remoteOrgId);
  if (error) throw hostedError(error);
  return (data ?? []) as { user_id: string; role: string; created_at: string }[];
}

export async function removeHostedMember(remoteOrgId: string, userId: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { error } = await supabase.from('org_members').delete().eq('org_id', remoteOrgId).eq('user_id', userId);
  if (error) throw hostedError(error);
}

export async function leaveHostedOrg(remoteOrgId: string) {
  const supabase = getHostedClient();
  if (!supabase) return;
  await restoreSessionIfNeeded();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await removeHostedMember(remoteOrgId, data.user.id);
}

export async function deleteHostedOrg(remoteOrgId: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { error } = await supabase.from('orgs').delete().eq('id', remoteOrgId);
  if (error) throw hostedError(error);
}

export { findChartByHash };
