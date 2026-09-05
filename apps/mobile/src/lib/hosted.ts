import { createHostedClient, type HostedChart } from '@setlist-ultra/api';
import { config, isHostedConfigured } from './config';
import {
  createOrg,
  findChartByHash,
  findOrCreateChart,
  getLibraryScope,
  insertLibrarySong,
  listOrgs,
  listSongs,
  newId,
  now,
  saveSyncState,
  updateSong,
} from './repository';
import { getDatabase } from './db';
import { orgs, songs } from '@setlist-ultra/db';
import { eq } from 'drizzle-orm';

let client: ReturnType<typeof createHostedClient> | null = null;

export function getHostedClient() {
  if (!isHostedConfigured()) return null;
  if (!client) client = createHostedClient(config.supabaseUrl, config.supabaseAnonKey);
  return client;
}

export async function hostedSignIn(email: string, password: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured. Add EXPO_PUBLIC_SUPABASE_URL and ANON key.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await saveSyncState({ provider: 'supabase', accountEmail: email, accessToken: data.session?.access_token });
  return data.user;
}

export async function hostedSignUp(email: string, password: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.session) {
    await saveSyncState({ provider: 'supabase', accountEmail: email, accessToken: data.session.access_token });
  }
  return data.user;
}

export async function hostedSignOut() {
  const supabase = getHostedClient();
  await supabase?.auth.signOut();
  await saveSyncState({ provider: 'local', accountEmail: undefined });
}

export async function hostedSessionEmail(): Promise<string | null> {
  const supabase = getHostedClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function lookupRemoteChart(contentHash: string, sourceProvider?: string, sourceExternalId?: string) {
  const supabase = getHostedClient();
  if (!supabase) return null;

  if (sourceProvider && sourceExternalId) {
    const bySource = await supabase
      .from('charts')
      .select('*')
      .eq('source_provider', sourceProvider)
      .eq('source_external_id', sourceExternalId)
      .maybeSingle();
    if (bySource.data) return bySource.data as HostedChart;
  }

  const byHash = await supabase.from('charts').select('*').eq('content_hash', contentHash).maybeSingle();
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
  const existing = await lookupRemoteChart(
    input.contentHash,
    input.sourceProvider ?? undefined,
    input.sourceExternalId ?? undefined,
  );
  if (existing) return existing;
  const { data, error } = await supabase
    .from('charts')
    .insert({
      content_hash: input.contentHash,
      chordpro: input.chordpro,
      ast: input.ast ? JSON.parse(input.ast) : null,
      title: input.title,
      artist: input.artist,
      original_key: input.originalKey,
      source_provider: input.sourceProvider,
      source_external_id: input.sourceExternalId,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as HostedChart;
}

export async function syncPersonalLibrary() {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Sign in to hosted sync first.');
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Not signed in.');

  const scope = await getLibraryScope();
  const localSongs = await listSongs(scope);

  for (const song of localSongs) {
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

    await supabase.from('library_items').upsert({
      id: song.remoteId ?? song.id,
      user_id: scope.libraryKind === 'personal' ? user.id : null,
      org_id: scope.libraryKind === 'org' ? scope.orgId : null,
      chart_id: remoteChart.id,
      title: song.title,
      artist: song.artist,
      capo: song.capo,
      key_shift: song.keyShift,
      duration_seconds: song.duration2 ?? song.durationSeconds,
      extras: {
        notesText: song.notesText,
        tags: song.tags,
        syncId: song.syncId,
        sbpId: song.sbpId,
      },
      updated_at: now(),
    });
    if (!song.remoteId) {
      await updateSong(song.id, { remoteId: song.remoteId ?? song.id, syncStatus: 'synced' });
    } else {
      await updateSong(song.id, { syncStatus: 'synced' });
    }
  }

  const remoteFilter =
    scope.libraryKind === 'org' && scope.orgId
      ? supabase.from('library_items').select('*, charts(*)').eq('org_id', scope.orgId)
      : supabase.from('library_items').select('*, charts(*)').eq('user_id', user.id);

  const { data: remoteItems, error } = await remoteFilter;
  if (error) throw error;

  for (const item of remoteItems ?? []) {
    const chart = (item as { charts?: HostedChart }).charts;
    if (!chart?.chordpro) continue;
    const localChartId = await findOrCreateChart({
      chordpro: chart.chordpro,
      ast: chart.ast ?? undefined,
      title: chart.title ?? item.title,
      artist: chart.artist ?? item.artist,
      originalKey: chart.original_key ?? undefined,
      contentHash: chart.content_hash,
      sourceProvider: chart.source_provider,
      sourceExternalId: chart.source_external_id,
    });
    const existing = localSongs.find((s) => s.remoteId === item.id || s.contentHash === chart.content_hash);
    if (existing) continue;
    await insertLibrarySong({
      title: item.title,
      artist: item.artist,
      capo: item.capo ?? 0,
      chordpro: chart.chordpro,
      originalKey: chart.original_key ?? undefined,
      sourceProvider: chart.source_provider,
      sourceExternalId: chart.source_external_id ?? undefined,
      scope,
    });
    void localChartId;
  }

  await saveSyncState({
    provider: 'supabase',
    accountEmail: user.email ?? undefined,
  });
}

export async function syncOrgFromHost(inviteCode: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const { data: org, error } = await supabase.from('orgs').select('*').eq('invite_code', inviteCode).maybeSingle();
  if (error) throw error;
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
  if (error) throw error;
  return (data ?? []) as { user_id: string; role: string; created_at: string }[];
}

export async function removeHostedMember(remoteOrgId: string, userId: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { error } = await supabase.from('org_members').delete().eq('org_id', remoteOrgId).eq('user_id', userId);
  if (error) throw error;
}

export async function leaveHostedOrg(remoteOrgId: string) {
  const supabase = getHostedClient();
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await removeHostedMember(remoteOrgId, data.user.id);
}

export async function deleteHostedOrg(remoteOrgId: string) {
  const supabase = getHostedClient();
  if (!supabase) throw new Error('Hosted sync is not configured.');
  const { error } = await supabase.from('orgs').delete().eq('id', remoteOrgId);
  if (error) throw error;
}

export { findChartByHash };
