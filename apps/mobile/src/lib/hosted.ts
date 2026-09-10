import { createHostedClient, type HostedChart } from '@setlist-ultra/api';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { config, isHostedConfigured } from './config';
import {
  createOrg,
  findChartByHash,
  findOrCreateChart,
  getLibraryScope,
  getSetlistItems,
  getSyncState,
  insertLibrarySong,
  listOrgs,
  listSetlists,
  listSongs,
  newId,
  now,
  saveSyncState,
  updateSong,
} from './repository';
import { getDatabase } from './db';
import { orgs, setlistItems, setlists } from '@setlist-ultra/db';
import { eq } from 'drizzle-orm';

WebBrowser.maybeCompleteAuthSession();

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: ReturnType<typeof createHostedClient> | null = null;
let restoreAttempted = false;

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
      storage: ExpoSecureStoreAdapter,
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
    accountEmail: email ?? undefined,
    accessToken: accessToken ?? undefined,
    refreshToken: refreshToken ?? undefined,
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
  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Google sign-in cancelled.');
    }
    throw new Error('Google sign-in did not complete.');
  }

  return completeOAuthFromUrl(result.url);
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

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(String(errorCode));

  const access_token = typeof params.access_token === 'string' ? params.access_token : undefined;
  const refresh_token = typeof params.refresh_token === 'string' ? params.refresh_token : undefined;
  const code = typeof params.code === 'string' ? params.code : undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw hostedError(error);
    return data.session;
  }

  if (access_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? '',
    });
    if (error) throw hostedError(error);
    return data.session;
  }

  // Fallback: Linking.parse when QueryParams missed hash fragments on some platforms.
  const parsed = Linking.parse(url);
  const qp = parsed.queryParams ?? {};
  const fallbackCode = typeof qp.code === 'string' ? qp.code : undefined;
  if (fallbackCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(fallbackCode);
    if (error) throw hostedError(error);
    return data.session;
  }

  return null;
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
  charts?: HostedChart | null;
};

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
  },
) {
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

export async function syncPersonalLibrary() {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Sign in to hosted sync first.');
  await restoreSessionIfNeeded();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Not signed in.');

  const scope = await getLibraryScope();
  const localSongs = await listSongs(scope);
  const libraryIdBySong = new Map<string, string>();
  const userId = scope.libraryKind === 'personal' ? user.id : null;
  const orgId = scope.libraryKind === 'org' ? (scope.orgId ?? null) : null;

  for (const song of localSongs) {
    if (song.deleted || !song.contentHash) continue;
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
      durationSeconds: song.duration2 ?? song.durationSeconds,
      extras: {
        notesText: song.notesText,
        tags: song.tags,
        syncId: song.syncId,
        sbpId: song.sbpId,
        localId: song.id,
      },
    });
    libraryIdBySong.set(song.id, remoteLibraryId);
    await updateSong(song.id, { remoteId: remoteLibraryId, syncStatus: 'synced' });
  }

  const remoteFilter =
    orgId
      ? supabase.from('library_items').select('*, charts(*)').eq('org_id', orgId)
      : supabase.from('library_items').select('*, charts(*)').eq('user_id', user.id);

  const { data: remoteItems, error } = await remoteFilter;
  if (error) throw hostedError(error);

  const refreshedSongs = await listSongs(scope);
  for (const item of (remoteItems ?? []) as RemoteLibraryRow[]) {
    const chart = item.charts;
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
    const existing = refreshedSongs.find((s) => s.remoteId === item.id || s.contentHash === chart.content_hash);
    if (existing) {
      if (existing.remoteId !== item.id) await updateSong(existing.id, { remoteId: item.id, syncStatus: 'synced' });
      libraryIdBySong.set(existing.id, item.id);
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
    await updateSong(localId, { remoteId: item.id, syncStatus: 'synced' });
    libraryIdBySong.set(localId, item.id);
  }

  await syncSetlists(supabase, {
    userId: user.id,
    scope,
    orgId,
    libraryIdBySong,
  });

  await saveSyncState({
    provider: 'supabase',
    accountEmail: user.email ?? undefined,
  });
}

async function syncSetlists(
  supabase: NonNullable<ReturnType<typeof getHostedClient>>,
  input: {
    userId: string;
    scope: Awaited<ReturnType<typeof getLibraryScope>>;
    orgId: string | null;
    libraryIdBySong: Map<string, string>;
  },
) {
  const db = await getDatabase();
  const localSets = await listSetlists(input.scope);

  for (const set of localSets) {
    if (set.deleted) continue;
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
      updated_at: now(),
    };

    let remoteSetId = isUuid(set.remoteId) ? set.remoteId : null;
    if (remoteSetId) {
      const { error } = await supabase.from('setlists').update(payload).eq('id', remoteSetId);
      if (error) throw hostedError(error);
    } else {
      const inserted = await supabase.from('setlists').insert(payload).select('id').maybeSingle();
      if (inserted.error) throw hostedError(inserted.error);
      remoteSetId = inserted.data?.id ?? null;
      if (!remoteSetId) throw new Error('Cloud setlist was not created.');
      await db.update(setlists).set({ remoteId: remoteSetId, syncStatus: 'synced', updatedAt: now() }).where(eq(setlists.id, set.id));
    }

    const { error: delError } = await supabase.from('setlist_items').delete().eq('setlist_id', remoteSetId);
    if (delError) throw hostedError(delError);

    const items = await getSetlistItems(set.id);
    const rows = items.map((item, index) => ({
      setlist_id: remoteSetId,
      library_item_id: item.songId ? input.libraryIdBySong.get(item.songId) ?? null : null,
      sort_order: item.sortOrder ?? index,
      key_offset: item.keyOffset ?? 0,
      extras: {
        itemType: item.itemType,
        noteContent: item.noteContent,
        timerSeconds: item.timerSeconds,
        localId: item.id,
      },
    }));
    if (rows.length) {
      const { error: insError } = await supabase.from('setlist_items').insert(rows);
      if (insError) throw hostedError(insError);
    }
    if (isUuid(set.remoteId)) {
      await db.update(setlists).set({ syncStatus: 'synced', updatedAt: now() }).where(eq(setlists.id, set.id));
    }
  }

  const remoteSetsQuery = input.orgId
    ? supabase.from('setlists').select('*, setlist_items(*)').eq('org_id', input.orgId)
    : supabase.from('setlists').select('*, setlist_items(*)').eq('user_id', input.userId);
  const { data: remoteSets, error } = await remoteSetsQuery;
  if (error) throw hostedError(error);

  const songByRemoteLibraryId = new Map<string, string>();
  for (const [localId, remoteId] of input.libraryIdBySong) songByRemoteLibraryId.set(remoteId, localId);

  for (const remote of remoteSets ?? []) {
    const extras = (remote.extras ?? {}) as { localId?: string };
    const existing = localSets.find((set) => set.remoteId === remote.id || set.id === extras.localId);
    let localSetId = existing?.id;
    if (!localSetId) {
      localSetId = newId();
      await db.insert(setlists).values({
        id: localSetId,
        libraryKind: input.scope.libraryKind,
        orgId: input.scope.orgId ?? null,
        remoteId: remote.id,
        title: remote.title,
        eventDate: remote.event_date ?? now().slice(0, 10),
        syncStatus: 'synced',
        createdAt: now(),
        updatedAt: now(),
      });
    } else if (existing?.remoteId !== remote.id) {
      await db.update(setlists).set({ remoteId: remote.id, syncStatus: 'synced', updatedAt: now() }).where(eq(setlists.id, localSetId));
    }

    const remoteItems = (remote.setlist_items ?? []) as {
      library_item_id?: string | null;
      sort_order?: number;
      key_offset?: number;
      extras?: { itemType?: string; noteContent?: string; timerSeconds?: number };
    }[];
    if (!existing) {
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
        });
      }
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
