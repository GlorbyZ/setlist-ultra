import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  createEmptyDocument,
  documentToChordPro,
  fingerprintContent,
  keyNameToSbp,
  normalizeUgTab,
  parseChordPro,
  parseSbpArchive,
  packSbpArchive,
  sbpKeyToName,
  transposeDocument,
  wrapSemitones,
  type SbpLibrary,
  type SbpSetItem,
  type SbpSong,
  type SongDocument,
  type UgTabResponse,
} from '@setlist-ultra/core';
import {
  appState,
  charts,
  orgMembers,
  orgs,
  setlistItems,
  setlists,
  songs,
  syncState,
  type SongRow,
} from '@setlist-ultra/db';
import { getDatabase } from './db';

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export type LibraryScope = {
  libraryKind: 'personal' | 'org';
  orgId?: string | null;
};

function scopeFilter(scope: LibraryScope) {
  if (scope.libraryKind === 'org' && scope.orgId) {
    return and(eq(songs.deleted, 0), eq(songs.libraryKind, 'org'), eq(songs.orgId, scope.orgId));
  }
  return and(eq(songs.deleted, 0), eq(songs.libraryKind, 'personal'));
}

function setScopeFilter(scope: LibraryScope) {
  if (scope.libraryKind === 'org' && scope.orgId) {
    return and(eq(setlists.deleted, 0), eq(setlists.libraryKind, 'org'), eq(setlists.orgId, scope.orgId));
  }
  return and(eq(setlists.deleted, 0), eq(setlists.libraryKind, 'personal'));
}

export async function ensureAppState() {
  const db = await getDatabase();
  const rows = await db.select().from(appState).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(appState).values({ id: 'default' });
  const created = await db.select().from(appState).limit(1);
  return created[0];
}

export async function getAppState() {
  return ensureAppState();
}

export async function patchAppState(patch: Partial<typeof appState.$inferInsert>) {
  const db = await getDatabase();
  await ensureAppState();
  await db.update(appState).set(patch).where(eq(appState.id, 'default'));
}

export async function getLibraryScope(): Promise<LibraryScope> {
  const state = await ensureAppState();
  return {
    libraryKind: state.currentLibraryKind === 'org' ? 'org' : 'personal',
    orgId: state.currentOrgId,
  };
}

export async function listSongs(scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  return db.select().from(songs).where(scopeFilter(s)).orderBy(desc(songs.updatedAt));
}

export async function getSong(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSongsByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const db = await getDatabase();
  const rows = await db.select().from(songs).where(inArray(songs.id, unique));
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId[id]).filter(Boolean) as SongRow[];
}

export async function findChartByHash(contentHash: string) {
  const db = await getDatabase();
  const rows = await db.select().from(charts).where(eq(charts.contentHash, contentHash)).limit(1);
  return rows[0] ?? null;
}

export async function findChartBySource(provider: string, externalId: string) {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(charts)
    .where(and(eq(charts.sourceProvider, provider), eq(charts.sourceExternalId, externalId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findOrCreateChart(input: {
  chordpro: string;
  ast?: string;
  title?: string;
  artist?: string;
  originalKey?: string;
  sourceProvider?: string | null;
  sourceExternalId?: string | null;
  contentHash?: string;
}): Promise<string> {
  const db = await getDatabase();
  const contentHash = input.contentHash || fingerprintContent(input.chordpro);
  if (input.sourceProvider && input.sourceExternalId) {
    const bySource = await findChartBySource(input.sourceProvider, input.sourceExternalId);
    if (bySource) return bySource.id;
  }
  const existing = await findChartByHash(contentHash);
  if (existing) return existing.id;

  const id = newId();
  await db.insert(charts).values({
    id,
    contentHash,
    sourceProvider: input.sourceProvider ?? null,
    sourceExternalId: input.sourceExternalId ?? null,
    chordpro: input.chordpro,
    ast: input.ast ?? null,
    title: input.title ?? null,
    artist: input.artist ?? null,
    originalKey: input.originalKey ?? null,
    createdAt: now(),
  });
  return id;
}

function documentFromSong(row: { chordpro?: string | null; contentAst: string }): SongDocument {
  if (row.chordpro) {
    return parseChordPro(row.chordpro).document;
  }
  try {
    return JSON.parse(row.contentAst) as SongDocument;
  } catch {
    return createEmptyDocument();
  }
}

export function parseSongDocument(row: { chordpro?: string | null; contentAst: string }): SongDocument {
  return documentFromSong(row);
}

async function nextSbpIds(countSongs = 1, countSets = 0, countItems = 0) {
  const db = await getDatabase();
  const state = await ensureAppState();
  const songStart = state.nextSbpSongId ?? 1;
  const setStart = state.nextSbpSetId ?? 1;
  const itemStart = state.nextSbpItemId ?? 1;
  await db
    .update(appState)
    .set({
      nextSbpSongId: songStart + countSongs,
      nextSbpSetId: setStart + countSets,
      nextSbpItemId: itemStart + countItems,
    })
    .where(eq(appState.id, 'default'));
  return { songStart, setStart, itemStart };
}

export async function saveSongFromUg(
  tab: UgTabResponse,
  sourceUrl: string,
  options?: LibraryScope | { scope?: LibraryScope; transpose?: number; capo?: number },
) {
  const scope = options && 'libraryKind' in options ? options : options?.scope;
  const transpose = options && 'transpose' in options ? (options.transpose ?? 0) : 0;
  const normalized = normalizeUgTab(tab, sourceUrl);
  const document = transpose ? transposeDocument(normalized.document, transpose) : normalized.document;
  const originalKey = shiftStoredKey(normalized.meta.originalKey, transpose);
  const capo = options && 'capo' in options && options.capo != null ? options.capo : (normalized.meta.capo ?? 0);
  const chordpro = documentToChordPro(document, {
    title: normalized.meta.title,
    artist: normalized.meta.artist,
    key: originalKey,
    capo,
  });
  const ugId = sourceUrl.match(/(\d+)(?:\/)?$/)?.[1] ?? sourceUrl;
  return insertLibrarySong({
    title: normalized.meta.title,
    artist: normalized.meta.artist,
    originalKey,
    capo,
    chordpro,
    document,
    sourceProvider: 'ultimate_guitar',
    sourceUrl,
    importSource: 'web:ultimate-guitar.com',
    sourceExternalId: ugId,
    scope,
  });
}

function shiftStoredKey(name: string | undefined, semitones: number) {
  if (!semitones) return name;
  const idx = keyNameToSbp(name);
  if (idx == null) return name;
  return sbpKeyToName(wrapSemitones(idx + semitones));
}

export async function insertLibrarySong(input: {
  title: string;
  artist?: string;
  subtitle?: string;
  originalKey?: string;
  capo?: number;
  tempo?: number;
  durationSeconds?: number;
  duration2?: number;
  chordpro: string;
  document?: SongDocument;
  sourceProvider?: string | null;
  sourceUrl?: string | null;
  importSource?: string | null;
  sourceExternalId?: string | null;
  sbp?: SbpSong;
  contentKind?: string;
  mediaUri?: string;
  scope?: LibraryScope;
}): Promise<string> {
  const db = await getDatabase();
  const scope = input.scope ?? (await getLibraryScope());
  const document = input.document ?? parseChordPro(input.chordpro).document;
  const ast = JSON.stringify(document);
  const contentHash = input.sbp?.hash || fingerprintContent(input.chordpro);
  const chartId = await findOrCreateChart({
    chordpro: input.chordpro,
    ast,
    title: input.title,
    artist: input.artist,
    originalKey: input.originalKey,
    sourceProvider: input.sourceProvider ?? input.sbp?.importSource ?? null,
    sourceExternalId: input.sourceExternalId ?? null,
    contentHash,
  });

  const id = newId();
  const timestamp = now();
  const sbp = input.sbp;
  let sbpId = sbp?.Id;
  if (sbpId == null) {
    sbpId = (await nextSbpIds(1)).songStart;
  } else {
    const state = await ensureAppState();
    if ((state.nextSbpSongId ?? 1) <= sbpId) {
      await patchAppState({ nextSbpSongId: sbpId + 1 });
    }
  }

  const keyInt = sbp?.key ?? keyNameToSbp(input.originalKey) ?? 0;

  await db.insert(songs).values({
    id,
    chartId,
    libraryKind: scope.libraryKind,
    orgId: scope.orgId ?? null,
    sbpId,
    syncId: sbp?.SyncId ?? newId(),
    title: input.title,
    subtitle: input.subtitle ?? sbp?.subTitle ?? null,
    artist: input.artist ?? sbp?.author ?? '',
    originalKey: input.originalKey ?? sbpKeyToName(keyInt) ?? null,
    keyInt,
    keyShift: sbp?.KeyShift ?? 0,
    capo: input.capo ?? sbp?.Capo ?? 0,
    tempo: input.tempo ?? sbp?.TempoInt ?? null,
    durationSeconds: input.durationSeconds ?? sbp?.Duration ?? 90,
    duration2: input.duration2 ?? sbp?.Duration2 ?? null,
    copyright: sbp?.Copyright ?? null,
    notesText: sbp?.NotesText ?? null,
    sectionOrder: sbp?.SectionOrder ?? null,
    tags: typeof sbp?._tags === 'string' ? sbp._tags : sbp?._tags ? JSON.stringify(sbp._tags) : null,
    webUrl: input.sourceUrl ?? sbp?.Url ?? null,
    songNumber: sbp?.SongNumber ?? null,
    vName: sbp?.vName ?? null,
    locked: sbp?.locked ? 1 : 0,
    linkedAudio: typeof sbp?.LinkedAudio === 'string' ? sbp.LinkedAudio : null,
    chordsJson: sbp?.Chords != null ? JSON.stringify(sbp.Chords) : null,
    midiOnLoad: sbp?.midiOnLoad != null ? JSON.stringify(sbp.midiOnLoad) : null,
    importSource: input.importSource ?? sbp?.importSource ?? null,
    timeSig: sbp?.timeSig ?? null,
    zoomFactor: sbp?.ZoomFactor != null ? String(sbp.ZoomFactor) : sbp?.Zoom != null ? String(sbp.Zoom) : null,
    contentKind: input.contentKind ?? 'chordpro',
    sourceProvider: input.sourceProvider ?? null,
    sourceUrl: input.sourceUrl ?? null,
    contentAst: ast,
    chordpro: input.chordpro,
    contentHash,
    mediaUri: input.mediaUri ?? null,
    deleted: sbp?.Deleted ? 1 : 0,
    extras: sbp ? JSON.stringify(sbp) : null,
    syncStatus: 'local',
    createdAt: typeof sbp?.ModifiedDateTime === 'string' ? sbp.ModifiedDateTime : timestamp,
    updatedAt: timestamp,
  });

  return id;
}

export async function createBlankSong(title = 'Untitled', scope?: LibraryScope) {
  const document = createEmptyDocument(title);
  const chordpro = documentToChordPro(document, { title });
  return insertLibrarySong({
    title,
    artist: '',
    chordpro,
    document,
    importSource: 'editor',
    sourceProvider: 'manual',
    scope,
  });
}

export async function updateSong(
  id: string,
  patch: {
    title?: string;
    artist?: string;
    subtitle?: string;
    capo?: number;
    tempo?: number;
    durationSeconds?: number;
    duration2?: number;
    originalKey?: string;
    keyShift?: number;
    chordpro?: string;
    notesText?: string;
    webUrl?: string;
    tags?: string;
    midiOnLoad?: string;
    syncStatus?: string;
    remoteId?: string;
  },
) {
  const db = await getDatabase();
  const row = await getSong(id);
  if (!row) return;

  let chordpro = patch.chordpro ?? row.chordpro;
  let contentAst = row.contentAst;
  let contentHash = row.contentHash;
  let chartId = row.chartId;

  if (patch.chordpro != null) {
    const parsed = parseChordPro(patch.chordpro);
    contentAst = JSON.stringify(parsed.document);
    contentHash = fingerprintContent(patch.chordpro);
    chartId = await findOrCreateChart({
      chordpro: patch.chordpro,
      ast: contentAst,
      title: patch.title ?? row.title,
      artist: patch.artist ?? row.artist,
      originalKey: patch.originalKey ?? row.originalKey ?? undefined,
      contentHash,
    });
    chordpro = patch.chordpro;
  }

  const keyInt =
    patch.originalKey != null ? (keyNameToSbp(patch.originalKey) ?? row.keyInt) : row.keyInt;

  await db
    .update(songs)
    .set({
      title: patch.title ?? row.title,
      artist: patch.artist ?? row.artist,
      subtitle: patch.subtitle ?? row.subtitle,
      capo: patch.capo ?? row.capo,
      tempo: patch.tempo ?? row.tempo,
      durationSeconds: patch.durationSeconds ?? row.durationSeconds,
      duration2: patch.duration2 ?? row.duration2,
      originalKey: patch.originalKey ?? row.originalKey,
      keyInt,
      keyShift: patch.keyShift ?? row.keyShift,
      notesText: patch.notesText ?? row.notesText,
      webUrl: patch.webUrl ?? row.webUrl,
      tags: patch.tags ?? row.tags,
      midiOnLoad: patch.midiOnLoad ?? row.midiOnLoad,
      chordpro,
      contentAst,
      contentHash,
      chartId,
      syncStatus: patch.syncStatus ?? 'local',
      remoteId: patch.remoteId ?? row.remoteId,
      updatedAt: now(),
    })
    .where(eq(songs.id, id));
}

export async function deleteSong(id: string) {
  const db = await getDatabase();
  await db.update(songs).set({ deleted: 1, updatedAt: now() }).where(eq(songs.id, id));
}

export async function listSetlists(scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  return db
    .select()
    .from(setlists)
    .where(setScopeFilter(s))
    .orderBy(desc(setlists.pinned), desc(setlists.eventDate), desc(setlists.updatedAt));
}

export async function getSetlist(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSetlistItems(setlistId: string) {
  const db = await getDatabase();
  return db
    .select()
    .from(setlistItems)
    .where(and(eq(setlistItems.setlistId, setlistId), eq(setlistItems.deleted, 0)))
    .orderBy(setlistItems.sortOrder);
}

export async function createSetlist(title: string, scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  const id = newId();
  const timestamp = now();
  const { setStart } = await nextSbpIds(0, 1, 0);
  await db.insert(setlists).values({
    id,
    libraryKind: s.libraryKind,
    orgId: s.orgId ?? null,
    sbpId: setStart,
    syncId: newId(),
    title,
    eventDate: timestamp.slice(0, 10),
    syncStatus: 'local',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return id;
}

export async function updateSetlist(
  id: string,
  patch: { title?: string; eventDate?: string; notes?: string; pinned?: number },
) {
  const db = await getDatabase();
  await db
    .update(setlists)
    .set({ ...patch, updatedAt: now(), syncStatus: 'local' })
    .where(eq(setlists.id, id));
}

export async function addSongToSetlist(setlistId: string, songId: string, keyOffset = 0) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();
  const { itemStart } = await nextSbpIds(0, 0, 1);
  const setRow = await getSetlist(setlistId);
  await db.insert(setlistItems).values({
    id,
    setlistId,
    sbpId: itemStart,
    syncId: newId(),
    sortOrder: existing.length,
    itemType: 'song',
    itemTypeInt: 1,
    songId,
    overrideTranspose: keyOffset,
    keyOffset,
  });
  await db
    .update(setlists)
    .set({ updatedAt: now(), syncStatus: 'local' })
    .where(eq(setlists.id, setlistId));
  return id;
}

export async function addNoteToSetlist(setlistId: string, noteContent: string) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();
  await db.insert(setlistItems).values({
    id,
    setlistId,
    sortOrder: existing.length,
    itemType: 'note',
    itemTypeInt: 2,
    noteContent,
    overrideTranspose: 0,
    keyOffset: 0,
  });
}

export async function addTimerToSetlist(setlistId: string, seconds: number) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();
  await db.insert(setlistItems).values({
    id,
    setlistId,
    sortOrder: existing.length,
    itemType: 'timer',
    itemTypeInt: 3,
    timerSeconds: seconds,
    overrideTranspose: 0,
    keyOffset: 0,
  });
  return id;
}

export async function reorderSetlistItems(setlistId: string, orderedIds: string[]) {
  const db = await getDatabase();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(setlistItems).set({ sortOrder: i }).where(eq(setlistItems.id, orderedIds[i]));
  }
  await db.update(setlists).set({ updatedAt: now() }).where(eq(setlists.id, setlistId));
}

export async function updateSetlistItem(
  id: string,
  patch: { keyOffset?: number; overrideCapo?: number; noteContent?: string },
) {
  const db = await getDatabase();
  await db
    .update(setlistItems)
    .set({
      keyOffset: patch.keyOffset,
      overrideTranspose: patch.keyOffset,
      overrideCapo: patch.overrideCapo,
      noteContent: patch.noteContent,
    })
    .where(eq(setlistItems.id, id));
}

export async function removeSetlistItem(id: string) {
  const db = await getDatabase();
  await db.update(setlistItems).set({ deleted: 1 }).where(eq(setlistItems.id, id));
}

export async function deleteSetlist(id: string) {
  const db = await getDatabase();
  await db.update(setlists).set({ deleted: 1, updatedAt: now() }).where(eq(setlists.id, id));
}

export async function setlistDuration(setlistId: string): Promise<number> {
  const items = await getSetlistItems(setlistId);
  const songIds = items.map((i) => i.songId).filter(Boolean) as string[];
  if (!songIds.length) return items.reduce((sum, i) => sum + (i.timerSeconds ?? 0), 0);
  const db = await getDatabase();
  const rows = await db.select().from(songs).where(inArray(songs.id, songIds));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  return items.reduce((sum, item) => {
    if (item.itemType === 'timer') return sum + (item.timerSeconds ?? 0);
    const song = item.songId ? byId[item.songId] : null;
    return sum + (song?.duration2 ?? song?.durationSeconds ?? 0);
  }, 0);
}

export async function copySongToLibrary(songId: string, scope: LibraryScope) {
  const row = await getSong(songId);
  if (!row) throw new Error('Song not found');
  return insertLibrarySong({
    title: row.title,
    artist: row.artist,
    subtitle: row.subtitle ?? undefined,
    originalKey: row.originalKey ?? undefined,
    capo: row.capo ?? 0,
    tempo: row.tempo ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    duration2: row.duration2 ?? undefined,
    chordpro: row.chordpro,
    sourceProvider: row.sourceProvider,
    sourceUrl: row.sourceUrl,
    importSource: row.importSource,
    scope,
  });
}

export async function listOrgs() {
  const db = await getDatabase();
  return db.select().from(orgs).orderBy(orgs.name);
}

export async function createOrg(name: string) {
  const db = await getDatabase();
  const id = newId();
  const timestamp = now();
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  await db.insert(orgs).values({ id, name, inviteCode, createdAt: timestamp, updatedAt: timestamp });
  return { id, inviteCode };
}

export async function joinOrgByCode(code: string, email = 'local') {
  const db = await getDatabase();
  const rows = await db.select().from(orgs);
  const match = rows.find((o) => (o.inviteCode ?? '').toUpperCase() === code.trim().toUpperCase());
  if (!match) throw new Error('Invite code not found');
  await db.insert(orgMembers).values({
    id: newId(),
    orgId: match.id,
    email,
    role: 'member',
    createdAt: now(),
  });
  return match;
}

export async function listOrgMembers(orgId: string) {
  const db = await getDatabase();
  return db.select().from(orgMembers).where(eq(orgMembers.orgId, orgId));
}

export async function removeOrgMember(memberId: string) {
  const db = await getDatabase();
  await db.delete(orgMembers).where(eq(orgMembers.id, memberId));
}

export async function leaveOrg(orgId: string, email: string) {
  const db = await getDatabase();
  const rows = await db.select().from(orgMembers).where(eq(orgMembers.orgId, orgId));
  const mine = rows.filter((row) => row.email.toLowerCase() === email.toLowerCase());
  for (const row of mine) {
    await db.delete(orgMembers).where(eq(orgMembers.id, row.id));
  }
}

export async function deleteOrg(orgId: string) {
  const db = await getDatabase();
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgId));
  await db.delete(orgs).where(eq(orgs.id, orgId));
}

export async function getSyncState() {
  const db = await getDatabase();
  const rows = await db.select().from(syncState).limit(1);
  return rows[0] ?? null;
}

export async function saveSyncState(data: {
  provider: string;
  accountEmail?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
}) {
  const db = await getDatabase();
  const existing = await getSyncState();
  if (existing) {
    await db
      .update(syncState)
      .set({
        provider: data.provider,
        accountEmail: data.accountEmail,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: data.tokenExpiry,
        lastSyncAt: now(),
      })
      .where(eq(syncState.id, 'default'));
    return;
  }
  await db.insert(syncState).values({
    id: 'default',
    provider: data.provider,
    accountEmail: data.accountEmail,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenExpiry: data.tokenExpiry,
    lastSyncAt: now(),
  });
}

export function songToSbp(row: SongRow): SbpSong {
  const extras = row.extras ? (JSON.parse(row.extras) as SbpSong) : ({} as SbpSong);
  return {
    ...extras,
    Id: row.sbpId ?? 0,
    author: row.artist,
    Capo: row.capo,
    content: row.chordpro ?? '',
    hash: row.contentHash ?? fingerprintContent(row.chordpro ?? ''),
    key: row.keyInt ?? 0,
    KeyShift: row.keyShift ?? 0,
    name: row.title,
    subTitle: row.subtitle,
    type: extras.type ?? 1,
    ModifiedDateTime: row.updatedAt,
    Deleted: row.deleted === 1,
    SyncId: row.syncId,
    timeSig: row.timeSig,
    ZoomFactor: row.zoomFactor ? Number(row.zoomFactor) : extras.ZoomFactor,
    Duration: row.durationSeconds,
    Duration2: row.duration2,
    TempoInt: row.tempo,
    _tags: row.tags,
    Url: row.webUrl,
    Copyright: row.copyright,
    NotesText: row.notesText,
    SectionOrder: row.sectionOrder,
    SongNumber: row.songNumber,
    vName: row.vName,
    locked: row.locked === 1,
    LinkedAudio: row.linkedAudio,
    midiOnLoad: row.midiOnLoad ? JSON.parse(row.midiOnLoad) : extras.midiOnLoad,
    importSource: row.importSource,
  };
}

export async function buildSbpLibrary(scope?: LibraryScope, setId?: string): Promise<SbpLibrary> {
  const s = scope ?? (await getLibraryScope());
  const songRows = await listSongs(s);
  const setRows = setId
    ? [await getSetlist(setId)].filter(Boolean)
    : await listSetlists(s);

  const sets = [];
  const usedSongSbp = new Set<number>();

  for (const set of setRows) {
    if (!set) continue;
    const items = await getSetlistItems(set.id);
    const contents: SbpSetItem[] = items.map((item, index) => {
      const song = songRows.find((row) => row.id === item.songId);
      if (song?.sbpId != null) usedSongSbp.add(song.sbpId);
      return {
        Id: item.sbpId ?? index + 1,
        Order: item.sortOrder,
        Capo: item.overrideCapo,
        SetId: set.sbpId,
        SongId: song?.sbpId ?? null,
        keyOfset: item.keyOffset ?? item.overrideTranspose ?? 0,
        NotesText: item.noteContent,
        SectionOrder: item.sectionOrder,
        ItemType: item.itemTypeInt ?? (item.itemType === 'song' ? 1 : item.itemType === 'note' ? 2 : 3),
        Deleted: item.deleted === 1,
        SyncId: item.syncId,
      };
    });
    const extras = set.extras ? JSON.parse(set.extras) : {};
    sets.push({
      ...extras,
      details: {
        ...(extras.details ?? {}),
        Id: set.sbpId ?? 0,
        name: set.title,
        date: set.eventDate,
        ModifiedDateTime: set.updatedAt,
        Deleted: set.deleted === 1,
        SyncId: set.syncId,
        pinned: set.pinned === 1,
      },
      contents,
    });
  }

  const exportSongs = setId
    ? songRows.filter((row) => row.sbpId != null && usedSongSbp.has(row.sbpId))
    : songRows;

  return {
    songs: exportSongs.map(songToSbp),
    sets,
    folders: [],
  };
}

export async function importSbpArchive(bytes: Uint8Array, filename?: string, scope?: LibraryScope) {
  const kind = filename?.toLowerCase().endsWith('.sbpbackup') ? 'backup' : 'set';
  const parsed = parseSbpArchive(bytes, kind);
  const s = scope ?? (await getLibraryScope());
  const idMap = new Map<number, string>();

  if (parsed.settingsHive) {
    await patchAppState({ settingsHiveB64: uint8ToB64(parsed.settingsHive) });
  }

  let maxSong = 0;
  let maxSet = 0;
  let maxItem = 0;

  for (const song of parsed.library.songs) {
    const uuid = await insertLibrarySong({
      title: song.name || 'Untitled',
      artist: song.author || '',
      subtitle: song.subTitle ?? undefined,
      originalKey: sbpKeyToName(song.key ?? 0),
      capo: song.Capo ?? 0,
      tempo: song.TempoInt ?? undefined,
      durationSeconds: song.Duration ?? undefined,
      duration2: song.Duration2 ?? undefined,
      chordpro: song.content ?? '',
      sbp: song,
      importSource: song.importSource ?? null,
      sourceProvider: song.importSource?.includes('ultimate-guitar')
        ? 'ultimate_guitar'
        : song.importSource?.includes('e-chords')
          ? 'e_chords'
          : 'sbp',
      sourceUrl: typeof song.Url === 'string' ? song.Url : null,
      sourceExternalId: typeof song.Url === 'string' ? song.Url : null,
      scope: s,
    });
    idMap.set(Number(song.Id), uuid);
    if (Number(song.Id) > maxSong) maxSong = Number(song.Id);
  }

  const db = await getDatabase();
  for (const set of parsed.library.sets) {
    const setUuid = newId();
    const timestamp = now();
    const details = set.details ?? { Id: 0 };
    await db.insert(setlists).values({
      id: setUuid,
      libraryKind: s.libraryKind,
      orgId: s.orgId ?? null,
      sbpId: Number(details.Id) || null,
      syncId: details.SyncId ?? newId(),
      title: details.name || 'Untitled set',
      eventDate: details.date ?? timestamp.slice(0, 10),
      pinned: details.pinned ? 1 : 0,
      deleted: details.Deleted ? 1 : 0,
      extras: JSON.stringify(set),
      syncStatus: 'local',
      createdAt: typeof details.ModifiedDateTime === 'string' ? details.ModifiedDateTime : timestamp,
      updatedAt: timestamp,
    });
    if (Number(details.Id) > maxSet) maxSet = Number(details.Id);

    for (const [index, item] of (set.contents ?? []).entries()) {
      const itemId = newId();
      const songUuid = item.SongId != null ? idMap.get(Number(item.SongId)) : undefined;
      await db.insert(setlistItems).values({
        id: itemId,
        setlistId: setUuid,
        sbpId: item.Id != null ? Number(item.Id) : index + 1,
        syncId: item.SyncId ?? newId(),
        sortOrder: item.Order ?? index,
        itemType: item.ItemType === 2 ? 'note' : item.ItemType === 3 ? 'timer' : 'song',
        itemTypeInt: item.ItemType ?? 1,
        songId: songUuid ?? null,
        noteContent: item.NotesText ?? item.Content ?? null,
        overrideTranspose: item.keyOfset ?? 0,
        overrideCapo: item.Capo ?? null,
        keyOffset: item.keyOfset ?? 0,
        sectionOrder: item.SectionOrder ?? null,
        extras: JSON.stringify(item),
        deleted: item.Deleted ? 1 : 0,
      });
      if (item.Id != null && Number(item.Id) > maxItem) maxItem = Number(item.Id);
    }
  }

  const state = await ensureAppState();
  await patchAppState({
    nextSbpSongId: Math.max(state.nextSbpSongId ?? 1, maxSong + 1),
    nextSbpSetId: Math.max(state.nextSbpSetId ?? 1, maxSet + 1),
    nextSbpItemId: Math.max(state.nextSbpItemId ?? 1, maxItem + 1),
  });

  return {
    songs: parsed.library.songs.length,
    sets: parsed.library.sets.length,
    hashOk: parsed.hashOk,
    kind: parsed.kind,
  };
}

export async function importAnyChartFile(bytes: Uint8Array, filename?: string) {
  const name = (filename ?? 'import.sbp').toLowerCase();
  if (name.endsWith('.sbp') || name.endsWith('.sbpbackup') || name.endsWith('.zip')) {
    const result = await importSbpArchive(bytes, filename);
    return { kind: 'archive' as const, songId: undefined, songs: result.songs, sets: result.sets, hashOk: result.hashOk };
  }

  const text = new TextDecoder().decode(bytes);
  const parsed = parseChordPro(text);
  const songId = await insertLibrarySong({
    title: parsed.meta.title || (filename ?? 'Imported').replace(/\.[^.]+$/, ''),
    artist: parsed.meta.artist || '',
    originalKey: parsed.meta.key,
    capo: parsed.meta.capo,
    tempo: parsed.meta.tempo,
    chordpro: text,
    document: parsed.document,
    importSource: 'editor',
    sourceProvider: 'chordpro',
  });
  return { kind: 'song' as const, songId, songs: 1, sets: 0, hashOk: true };
}

export async function exportSbpBytes(kind: 'backup' | 'set', setId?: string) {
  const library = await buildSbpLibrary(undefined, kind === 'set' ? setId : undefined);
  const state = await ensureAppState();
  const hive = kind === 'backup' && state.settingsHiveB64 ? b64ToUint8(state.settingsHiveB64) : undefined;
  return packSbpArchive(library, {
    kind,
    settingsHive: hive,
    setIds: kind === 'set' && library.sets[0]?.details?.Id != null ? [Number(library.sets[0].details.Id)] : undefined,
  });
}

export function uint8ToB64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  throw new Error('Base64 encoding is not available');
}

export function b64ToUint8(value: string): Uint8Array {
  if (typeof atob !== 'function') {
    throw new Error('Base64 decoding is not available');
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function catalogHitCount() {
  const db = await getDatabase();
  const rows = await db.select({ id: charts.id }).from(charts);
  return rows.length;
}
