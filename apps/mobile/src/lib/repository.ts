import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  compactCanonicalMap,
  createEmptyDocument,
  documentToChordPro,
  fingerprintContent,
  fingerprintNormalizedChart,
  chartBodyIsEmpty,
  foldUgName,
  namesLikelyMatch,
  keyNameToSbp,
  normalizeUgTab,
  parseChordPro,
  packSbpArchive,
  applyPatch,
  assertIdsBelongToSet,
  sbpKeyToName,
  setlistCloneSignature,
  shouldReuseArrangement,
  titlesLikelySame,
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
  folders,
  importJobs,
  orgMembers,
  orgs,
  setlistItems,
  setlists,
  songs,
  syncState,
  type SongRow,
} from '@setlist-ultra/db';
import { DEFAULT_AUTOSCROLL_SECONDS, resolveAutoscrollSeconds } from './autoscroll';
export { DEFAULT_AUTOSCROLL_SECONDS, resolveAutoscrollSeconds } from './autoscroll';
import { getDatabase } from './db';
import { readSessionSecrets, writeSessionSecrets } from './sessionSecrets';
import {
  commitLocal,
  enqueueOutbox,
  ensureWorkspace,
  ensureWorkspaceForScope,
  insertChartRevision,
  PERSONAL_WORKSPACE_ID,
  workspaceIdForScope,
  type LibraryScope,
  type MutationOrigin,
} from './domain';
export type { LibraryScope, MutationOrigin } from './domain';

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function now(): string {
  return new Date().toISOString();
}

function scopeFilter(scope: LibraryScope, importJobId?: string | null) {
  const base = and(eq(songs.deleted, 0), eq(songs.workspaceId, workspaceIdForScope(scope)));
  if (importJobId) return and(base, or(isNull(songs.importJobId), eq(songs.importJobId, importJobId)));
  return and(base, isNull(songs.importJobId));
}

function setScopeFilter(scope: LibraryScope) {
  return and(eq(setlists.deleted, 0), eq(setlists.workspaceId, workspaceIdForScope(scope)), isNull(setlists.importJobId));
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
  const libraryKind = state.currentLibraryKind === 'org' ? 'org' : 'personal';
  const orgId = state.currentOrgId;
  const scope: LibraryScope = { libraryKind, orgId };
  return { ...scope, workspaceId: workspaceIdForScope(scope) };
}


export function normalizeLibraryKey(title: string, artist?: string | null): string {
  return `${foldUgName(title || '')}|${foldUgName(artist || '')}`;
}

export async function findSongByContentHash(
  contentHash: string | string[],
  scope?: LibraryScope,
  importJobId?: string | null,
) {
  const hashes = (Array.isArray(contentHash) ? contentHash : [contentHash]).filter(Boolean);
  if (!hashes.length) return null;
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  const rows = await db
    .select()
    .from(songs)
    .where(and(scopeFilter(s, importJobId), inArray(songs.contentHash, hashes)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findSongBySourceId(
  provider: string,
  externalId: string,
  scope?: LibraryScope,
  importJobId?: string | null,
) {
  if (!provider || !externalId) return null;
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  const byExternal = await db
    .select()
    .from(songs)
    .where(
      and(
        scopeFilter(s, importJobId),
        eq(songs.sourceProvider, provider),
        eq(songs.sourceExternalId, externalId),
      ),
    )
    .limit(1);
  if (byExternal[0]) return byExternal[0];
  const rows = await db.select().from(songs).where(scopeFilter(s, importJobId));
  return (
    rows.find(
      (row) =>
        (row.sourceProvider === provider && (row.sourceUrl === externalId || row.webUrl === externalId)) ||
        (row.sourceProvider === provider && row.webUrl?.includes(externalId)),
    ) ?? null
  );
}

export async function findSongByTitleArtist(
  title: string,
  artist?: string | null,
  scope?: LibraryScope,
  importJobId?: string | null,
) {
  const key = normalizeLibraryKey(title, artist);
  if (!key || key === '|') return null;
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  const rows = await db.select().from(songs).where(scopeFilter(s, importJobId));
  return (
    rows.find((row) => {
      if (!titlesLikelySame(row.title, title)) return false;
      const incomingArtist = artist || '';
      if (!foldUgName(incomingArtist) || !foldUgName(row.artist)) return true;
      return namesLikelyMatch(row.artist, incomingArtist);
    }) ?? null
  );
}

/** Merge exact-content duplicate library songs only. Distinct arrangements are kept. */
export async function cleanDuplicateSongs(scope?: LibraryScope) {
  const s = scope ?? (await getLibraryScope());
  const rows = await listSongs(s);
  const db = await getDatabase();
  const dupeToCanonical = new Map<string, string>();

  const byHash = new Map<string, SongRow[]>();
  for (const row of rows) {
    const hash = row.contentHash || fingerprintContent(row.chordpro ?? '');
    if (!hash) continue;
    const list = byHash.get(hash) ?? [];
    list.push(row);
    byHash.set(hash, list);
  }
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const canonical = sorted[0];
    for (const dupe of sorted.slice(1)) dupeToCanonical.set(dupe.id, canonical.id);
  }

  const compact = compactCanonicalMap(dupeToCanonical);
  let removed = 0;
  for (const [dupeId, canonicalId] of compact) {
    if (dupeId === canonicalId) continue;
    await db.update(setlistItems).set({ songId: canonicalId }).where(eq(setlistItems.songId, dupeId));
    await db.update(songs).set({ deleted: 1, updatedAt: now() }).where(eq(songs.id, dupeId));
    removed += 1;
  }
  return { mergedGroups: compact.size ? new Set(compact.values()).size : 0, removed };
}

export async function listSongs(scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  return db.select().from(songs).where(scopeFilter(s)).orderBy(desc(songs.updatedAt));
}

/** Active + tombstoned songs in the workspace (sync drain). */
export async function listSongsForSync(scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  return db
    .select()
    .from(songs)
    .where(and(eq(songs.workspaceId, workspaceIdForScope(s)), isNull(songs.importJobId)))
    .orderBy(desc(songs.updatedAt));
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
    if (bySource && bySource.contentHash === contentHash) return bySource.id;
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

export async function nextSbpIds(countSongs = 1, countSets = 0, countItems = 0) {
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
    softDedupe: false,
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
  /** Soft title+artist reuse. Off unless callers opt in. Hard hash / source-id always reuse. */
  softDedupe?: boolean;
}): Promise<string> {
  return (await insertLibrarySongResult(input)).id;
}

export type InsertSongOutcome = 'created' | 'reused';

export async function insertLibrarySongResult(input: {
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
  softDedupe?: boolean;
  allocateLocalSbpId?: boolean;
  importJobId?: string | null;
}): Promise<{ id: string; outcome: InsertSongOutcome }> {
  const db = await getDatabase();
  const scope = input.scope ?? (await getLibraryScope());
  await ensureWorkspaceForScope(scope);
  const workspaceId = workspaceIdForScope(scope);
  const document = input.document ?? parseChordPro(input.chordpro).document;
  const ast = JSON.stringify(document);
  const rawHash = fingerprintContent(input.chordpro);
  const normalizedHash = fingerprintNormalizedChart(input.chordpro);
  const contentHash = input.sbp?.hash || rawHash;
  const artist = input.artist ?? input.sbp?.author ?? '';
  const variant = input.subtitle ?? input.sbp?.vName ?? input.sbp?.subTitle ?? null;

  const hard = await findSongByContentHash(
    [contentHash, rawHash, normalizedHash],
    scope,
    input.importJobId,
  );
  if (hard) return { id: hard.id, outcome: 'reused' };

  const sourceProvider =
    input.sourceProvider ??
    (input.sbp?.importSource?.includes('ultimate-guitar')
      ? 'ultimate_guitar'
      : input.sbp?.importSource?.includes('e-chords')
        ? 'e_chords'
        : null);
  const sourceExternalId =
    input.sourceExternalId ?? (typeof input.sbp?.Url === 'string' ? input.sbp.Url : null);
  if (sourceProvider && sourceExternalId) {
    const bySource = await findSongBySourceId(sourceProvider, sourceExternalId, scope, input.importJobId);
    if (bySource) return { id: bySource.id, outcome: 'reused' };
  }

  const dbSongs = await db.select().from(songs).where(scopeFilter(scope, input.importJobId));
  if (!chartBodyIsEmpty(input.chordpro)) {
    const byNormalized = dbSongs.find(
      (row) => row.chordpro && fingerprintNormalizedChart(row.chordpro) === normalizedHash,
    );
    if (byNormalized) return { id: byNormalized.id, outcome: 'reused' };
  }

  const byWork = dbSongs.find((row) =>
    shouldReuseArrangement({
      incomingTitle: input.title,
      incomingArtist: artist,
      incomingVariant: variant,
      incomingChordpro: input.chordpro,
      existingTitle: row.title,
      existingArtist: row.artist,
      existingVariant: row.subtitle ?? row.vName,
      existingChordpro: row.chordpro ?? '',
    }),
  );
  if (byWork) return { id: byWork.id, outcome: 'reused' };

  // Soft match remains available for callers that opt in (already covered by shouldReuseArrangement).
  if (input.softDedupe === true) {
    const soft = await findSongByTitleArtist(input.title, artist, scope, input.importJobId);
    if (soft) return { id: soft.id, outcome: 'reused' };
  }

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
  const revisionId = newId();
  const timestamp = now();
  const sbp = input.sbp;
  const allocateLocal = input.allocateLocalSbpId === true || sbp?.Id == null;
  let sbpId = allocateLocal ? undefined : sbp?.Id;
  if (sbpId == null) {
    sbpId = (await nextSbpIds(1)).songStart;
  } else {
    const state = await ensureAppState();
    if ((state.nextSbpSongId ?? 1) <= sbpId) {
      await patchAppState({ nextSbpSongId: sbpId + 1 });
    }
  }

  const keyInt = sbp?.key ?? keyNameToSbp(input.originalKey) ?? 0;

  await commitLocal(async () => {
    await db.insert(songs).values({
      id,
      chartId,
      libraryKind: scope.libraryKind,
      orgId: scope.orgId ?? null,
      workspaceId,
      revisionId,
      localRevision: 1,
      importJobId: input.importJobId ?? null,
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
      durationSeconds: input.durationSeconds ?? sbp?.Duration ?? DEFAULT_AUTOSCROLL_SECONDS,
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
      sourceExternalId: sourceExternalId ?? null,
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
    await insertChartRevision({
      id: revisionId,
      arrangementId: id,
      chartId,
      contentHash,
      chordpro: input.chordpro,
      ast,
    });
    await enqueueOutbox({
      workspaceId,
      entityId: id,
      entityType: 'arrangement',
      operationType: 'arrangement.create',
      localRevision: 1,
      payload: { title: input.title, artist: input.artist ?? '', contentHash },
    });
  });

  return { id, outcome: 'created' };
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
    softDedupe: false,
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
  options?: { origin?: MutationOrigin },
) {
  const origin = options?.origin ?? 'user';
  const apply = async () => {
    const db = await getDatabase();
    const row = await getSong(id);
    if (!row) return;

    let chordpro = patch.chordpro ?? row.chordpro;
    let contentAst = row.contentAst;
    let contentHash = row.contentHash;
    let chartId = row.chartId;
    let revisionId = row.revisionId;
    let localRevision = row.localRevision ?? 1;

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
      if (origin === 'user') {
        revisionId = await insertChartRevision({
          arrangementId: id,
          chartId,
          contentHash,
          chordpro: patch.chordpro,
          ast: contentAst,
          parentRevisionId: row.revisionId,
        });
      }
    }

    if (origin === 'user') localRevision = (row.localRevision ?? 1) + 1;

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
        revisionId,
        localRevision,
        syncStatus: patch.syncStatus ?? (origin === 'sync' ? row.syncStatus : 'local'),
        remoteId: patch.remoteId ?? row.remoteId,
        updatedAt: now(),
      })
      .where(eq(songs.id, id));

    if (origin === 'user') {
      await enqueueOutbox({
        workspaceId: row.workspaceId ?? workspaceIdForScope(await getLibraryScope()),
        entityId: id,
        entityType: 'arrangement',
        operationType: 'arrangement.update',
        localRevision,
        payload: { fields: Object.keys(patch) },
      });
    }
  };

  if (origin === 'user') return commitLocal(apply);
  return apply();
}

export async function deleteSongs(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  for (const id of unique) await deleteSong(id);
  return unique.length;
}

export async function deleteSong(id: string, options?: { origin?: MutationOrigin }) {
  const origin = options?.origin ?? 'user';
  const apply = async () => {
    const db = await getDatabase();
    const row = await getSong(id);
    if (!row) return;
    const localRevision = (row.localRevision ?? 1) + 1;
    await db
      .update(songs)
      .set({
        deleted: 1,
        updatedAt: now(),
        syncStatus: origin === 'sync' ? row.syncStatus : 'local',
        localRevision,
      })
      .where(eq(songs.id, id));
    if (origin === 'user') {
      await enqueueOutbox({
        workspaceId: row.workspaceId ?? PERSONAL_WORKSPACE_ID,
        entityId: id,
        entityType: 'arrangement',
        operationType: 'arrangement.delete',
        localRevision,
      });
    }
  };
  if (origin === 'user') return commitLocal(apply);
  return apply();
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

export async function listSetlistsForSync(scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  return db
    .select()
    .from(setlists)
    .where(and(eq(setlists.workspaceId, workspaceIdForScope(s)), isNull(setlists.importJobId)))
    .orderBy(desc(setlists.updatedAt));
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

async function getSetlistItem(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(setlistItems).where(eq(setlistItems.id, id)).limit(1);
  return rows[0] ?? null;
}

async function touchSetlist(setlistId: string, operationType: 'setlist.update' | 'setlist.item.upsert' | 'setlist.item.delete' | 'setlist.items.reorder' = 'setlist.update') {
  const db = await getDatabase();
  const row = await getSetlist(setlistId);
  if (!row) return;
  const localRevision = (row.localRevision ?? 1) + 1;
  const workspaceId = row.workspaceId ?? PERSONAL_WORKSPACE_ID;
  await db
    .update(setlists)
    .set({ updatedAt: now(), syncStatus: 'local', localRevision })
    .where(eq(setlists.id, setlistId));
  await enqueueOutbox({
    workspaceId,
    entityId: setlistId,
    entityType: 'setlist',
    operationType,
    localRevision,
  });
}

export async function createSetlist(title: string, scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  await ensureWorkspaceForScope(s);
  const workspaceId = workspaceIdForScope(s);
  const id = newId();
  const timestamp = now();
  const { setStart } = await nextSbpIds(0, 1, 0);
  await commitLocal(async () => {
    await db.insert(setlists).values({
      id,
      libraryKind: s.libraryKind,
      orgId: s.orgId ?? null,
      workspaceId,
      localRevision: 1,
      sbpId: setStart,
      syncId: newId(),
      title,
      eventDate: timestamp.slice(0, 10),
      syncStatus: 'local',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await enqueueOutbox({
      workspaceId,
      entityId: id,
      entityType: 'setlist',
      operationType: 'setlist.create',
      localRevision: 1,
      payload: { title },
    });
  });
  return id;
}

export async function updateSetlist(
  id: string,
  patch: { title?: string; eventDate?: string; notes?: string; pinned?: number },
) {
  await commitLocal(async () => {
    const db = await getDatabase();
    const row = await getSetlist(id);
    if (!row) return;
    const localRevision = (row.localRevision ?? 1) + 1;
    await db
      .update(setlists)
      .set({ ...patch, updatedAt: now(), syncStatus: 'local', localRevision })
      .where(eq(setlists.id, id));
    await enqueueOutbox({
      workspaceId: row.workspaceId ?? PERSONAL_WORKSPACE_ID,
      entityId: id,
      entityType: 'setlist',
      operationType: 'setlist.update',
      localRevision,
    });
  });
}

export async function addSongToSetlist(setlistId: string, songId: string, keyOffset = 0) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();
  const { itemStart } = await nextSbpIds(0, 0, 1);
  await commitLocal(async () => {
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
    await touchSetlist(setlistId, 'setlist.item.upsert');
  });
  return id;
}

export async function addNoteToSetlist(setlistId: string, noteContent: string) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();
  await commitLocal(async () => {
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
    await touchSetlist(setlistId, 'setlist.item.upsert');
  });
  return id;
}

export async function addTimerToSetlist(setlistId: string, seconds: number) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();
  await commitLocal(async () => {
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
    await touchSetlist(setlistId, 'setlist.item.upsert');
  });
  return id;
}

export async function reorderSetlistItems(setlistId: string, orderedIds: string[]) {
  const items = await getSetlistItems(setlistId);
  assertIdsBelongToSet(orderedIds, items.map((item) => item.id));
  await commitLocal(async () => {
    const db = await getDatabase();
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(setlistItems)
        .set({ sortOrder: i })
        .where(and(eq(setlistItems.id, orderedIds[i]), eq(setlistItems.setlistId, setlistId)));
    }
    await touchSetlist(setlistId, 'setlist.items.reorder');
  });
}

export async function updateSetlistItem(
  id: string,
  patch: { keyOffset?: number; overrideCapo?: number; noteContent?: string },
) {
  await commitLocal(async () => {
    const db = await getDatabase();
    const item = await getSetlistItem(id);
    if (!item) return;
    await db
      .update(setlistItems)
      .set({
        keyOffset: patch.keyOffset,
        overrideTranspose: patch.keyOffset,
        overrideCapo: patch.overrideCapo,
        noteContent: patch.noteContent,
      })
      .where(eq(setlistItems.id, id));
    await touchSetlist(item.setlistId, 'setlist.item.upsert');
  });
}

export async function removeSetlistItem(id: string) {
  await commitLocal(async () => {
    const db = await getDatabase();
    const item = await getSetlistItem(id);
    if (!item) return;
    await db.update(setlistItems).set({ deleted: 1 }).where(eq(setlistItems.id, id));
    await touchSetlist(item.setlistId, 'setlist.item.delete');
  });
}

/** Soft-delete exact clone setlists (same title and same ordered items). Songs stay in the library. */
export async function cleanDuplicateSetlists(scope?: LibraryScope) {
  const s = scope ?? (await getLibraryScope());
  const rows = await listSetlists(s);
  const byClone = new Map<string, typeof rows>();
  for (const row of rows) {
    const items = await getSetlistItems(row.id);
    const key = setlistCloneSignature(row.title, items);
    if (!key.trim()) continue;
    const list = byClone.get(key) ?? [];
    list.push(row);
    byClone.set(key, list);
  }
  let removed = 0;
  for (const group of byClone.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const dupe of sorted.slice(1)) {
      await deleteSetlist(dupe.id);
      removed += 1;
    }
  }
  return { removed };
}

export async function deleteSetlist(id: string, options?: { origin?: MutationOrigin }) {
  const origin = options?.origin ?? 'user';
  const apply = async () => {
    const db = await getDatabase();
    const row = await getSetlist(id);
    if (!row) return;
    const localRevision = origin === 'user' ? (row.localRevision ?? 1) + 1 : (row.localRevision ?? 1);
    await db
      .update(setlists)
      .set({
        deleted: 1,
        updatedAt: now(),
        syncStatus: origin === 'sync' ? row.syncStatus : 'local',
        localRevision,
      })
      .where(eq(setlists.id, id));
    if (origin === 'user') {
      await enqueueOutbox({
        workspaceId: row.workspaceId ?? PERSONAL_WORKSPACE_ID,
        entityId: id,
        entityType: 'setlist',
        operationType: 'setlist.delete',
        localRevision,
      });
    }
  };
  if (origin === 'user') return commitLocal(apply);
  return apply();
}

export async function setlistDurations(setlistIds: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(setlistIds.filter(Boolean))];
  const out: Record<string, number> = Object.fromEntries(unique.map((id) => [id, 0]));
  if (!unique.length) return out;
  const db = await getDatabase();
  const items = await db
    .select()
    .from(setlistItems)
    .where(and(inArray(setlistItems.setlistId, unique), eq(setlistItems.deleted, 0)));
  const songIds = [...new Set(items.map((i) => i.songId).filter(Boolean) as string[])];
  const rows = songIds.length
    ? await db
        .select({
          id: songs.id,
          duration2: songs.duration2,
          durationSeconds: songs.durationSeconds,
        })
        .from(songs)
        .where(inArray(songs.id, songIds))
    : [];
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  for (const item of items) {
    const id = item.setlistId;
    if (!(id in out)) continue;
    if (item.itemType === 'timer') {
      out[id] += item.timerSeconds ?? 0;
      continue;
    }
    const song = item.songId ? byId[item.songId] : null;
    out[id] += song?.duration2 ?? song?.durationSeconds ?? 0;
  }
  return out;
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
  await ensureWorkspace(`ws-org-${id}`, 'band', name, id);
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

async function getSyncStateRow() {
  const db = await getDatabase();
  const rows = await db.select().from(syncState).limit(1);
  return rows[0] ?? null;
}

export async function getSyncState() {
  const row = await getSyncStateRow();
  if (!row) return null;
  if (row.accessToken || row.refreshToken) {
    const provider = row.provider && row.provider !== 'local' ? row.provider : null;
    if (provider) {
      await writeSessionSecrets(provider, {
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
      });
    }
    const db = await getDatabase();
    await db
      .update(syncState)
      .set({ accessToken: null, refreshToken: null })
      .where(eq(syncState.id, row.id));
    row.accessToken = null;
    row.refreshToken = null;
  }
  const secrets = await readSessionSecrets(row.provider);
  return { ...row, accessToken: secrets.accessToken, refreshToken: secrets.refreshToken };
}

export async function touchLastSync() {
  const db = await getDatabase();
  const existing = await getSyncStateRow();
  if (!existing) return;
  await db.update(syncState).set({ lastSyncAt: now() }).where(eq(syncState.id, existing.id));
}

let syncStateWrite: Promise<void> = Promise.resolve();

function enqueueSyncStateWrite<T>(work: () => Promise<T>): Promise<T> {
  const run = syncStateWrite.then(work, work);
  syncStateWrite = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isSyncStateUniqueError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed:\s*sync_state\.id/i.test(text);
}

export async function saveSyncState(data: {
  provider: string;
  /** Pass null to clear; omit/undefined to keep existing on update. */
  accountEmail?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: string | null;
}) {
  return enqueueSyncStateWrite(async () => {
    const db = await getDatabase();
    const existing = await getSyncStateRow();
    const secretProvider =
      data.provider === 'local'
        ? existing?.provider && existing.provider !== 'local'
          ? existing.provider
          : 'supabase'
        : data.provider;
    await writeSessionSecrets(secretProvider, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    const applyRow = (row: NonNullable<typeof existing>) =>
      db
        .update(syncState)
        .set({
          provider: data.provider,
          accountEmail: applyPatch(data.accountEmail, row.accountEmail),
          accessToken: null,
          refreshToken: null,
          tokenExpiry: applyPatch(data.tokenExpiry, row.tokenExpiry),
        })
        .where(eq(syncState.id, row.id));

    if (existing) {
      await applyRow(existing);
      return;
    }

    try {
      await db.insert(syncState).values({
        id: 'default',
        provider: data.provider,
        accountEmail: data.accountEmail ?? undefined,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: data.tokenExpiry ?? undefined,
        lastSyncAt: null,
      });
    } catch (error) {
      if (!isSyncStateUniqueError(error)) throw error;
      const raced = await getSyncStateRow();
      if (!raced) throw error;
      await applyRow(raced);
    }
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

export async function listFolders(scope?: LibraryScope) {
  const db = await getDatabase();
  const s = scope ?? (await getLibraryScope());
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.workspaceId, workspaceIdForScope(s)), isNull(folders.importJobId)));
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

  const folderRows = setId ? [] : await listFolders(s);
  return {
    songs: exportSongs.map(songToSbp),
    sets,
    folders: folderRows.map((folder) => {
      const extras = folder.extras ? (JSON.parse(folder.extras) as Record<string, unknown>) : {};
      return { ...extras, Id: folder.sbpId ?? 0, name: folder.name };
    }),
  };
}

export type ImportProgressEvent = {
  phase: 'songs' | 'sets' | 'folders' | 'done';
  totalSongs: number;
  processedSongs: number;
  created: number;
  reused: number;
  variants: number;
  skipped: number;
  failed: number;
  totalSets?: number;
  processedSets?: number;
  totalFolders?: number;
  processedFolders?: number;
  currentTitle?: string;
  jobId?: string;
  status?: ImportJobStatus;
};

export type ImportJobStatus = 'running' | 'paused' | 'completed' | 'failed' | 'undone';

export type ImportOptions = {
  onProgress?: (event: ImportProgressEvent) => void;
  signal?: AbortSignal;
};

export type ImportArchiveResult = {
  songs: number;
  sets: number;
  folders: number;
  created: number;
  reused: number;
  variants: number;
  skipped: number;
  failed: number;
  hashOk: boolean;
  kind: string;
  jobId?: string;
  status?: ImportJobStatus;
};

type ImportCheckpoint = {
  processedSongs: number;
  nextSetIndex: number;
  nextFolderIndex: number;
  songIdMap: Record<string, string>;
  created: number;
  reused: number;
  variants: number;
  skipped: number;
  failed: number;
};

type ImportCreatedIds = {
  songs: string[];
  sets: string[];
  folders: string[];
};

function parseCreatedIds(raw?: string | null): ImportCreatedIds {
  if (!raw) return { songs: [], sets: [], folders: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ImportCreatedIds>;
    return {
      songs: Array.isArray(parsed.songs) ? parsed.songs : [],
      sets: Array.isArray(parsed.sets) ? parsed.sets : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    };
  } catch {
    return { songs: [], sets: [], folders: [] };
  }
}

export async function getImportJob(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(importJobs).where(eq(importJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listResumableImports() {
  const db = await getDatabase();
  return db
    .select()
    .from(importJobs)
    .where(eq(importJobs.status, 'paused'))
    .orderBy(desc(importJobs.updatedAt));
}

export async function getLastCompletedImport() {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.status, 'completed'))
    .orderBy(desc(importJobs.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function saveImportJobState(
  jobId: string,
  patch: {
    status?: ImportJobStatus;
    checkpoint?: ImportCheckpoint;
    createdIds?: ImportCreatedIds;
    report?: ImportArchiveResult;
    errorText?: string | null;
  },
) {
  const db = await getDatabase();
  await db
    .update(importJobs)
    .set({
      status: patch.status,
      checkpointJson: patch.checkpoint ? JSON.stringify(patch.checkpoint) : undefined,
      createdIdsJson: patch.createdIds ? JSON.stringify(patch.createdIds) : undefined,
      reportJson: patch.report ? JSON.stringify(patch.report) : undefined,
      errorText: patch.errorText === undefined ? undefined : patch.errorText,
      updatedAt: now(),
    })
    .where(eq(importJobs.id, jobId));
}

export async function undoImportJob(jobId: string) {
  const job = await getImportJob(jobId);
  if (!job || job.status === 'undone') return { removedSongs: 0, removedSets: 0, removedFolders: 0 };
  const created = parseCreatedIds(job.createdIdsJson);
  for (const id of created.sets) {
    try {
      await deleteSetlist(id);
    } catch {
      /* already gone */
    }
  }
  for (const id of created.songs) {
    try {
      await deleteSong(id);
    } catch {
      /* already gone */
    }
  }
  const db = await getDatabase();
  if (created.folders.length) {
    await db.delete(folders).where(inArray(folders.id, created.folders));
  }
  await saveImportJobState(jobId, { status: 'undone', errorText: null });
  return {
    removedSongs: created.songs.length,
    removedSets: created.sets.length,
    removedFolders: created.folders.length,
  };
}

export async function importSbpArchive(
  bytes: Uint8Array,
  filename?: string,
  scope?: LibraryScope,
  options?: ImportOptions,
): Promise<ImportArchiveResult> {
  const { importSbpArchive: run } = await import('./importEngine');
  return run(bytes, filename, scope, options);
}

export async function importAnyChartFile(bytes: Uint8Array, filename?: string, options?: ImportOptions) {
  const { importAnyChartFile: run } = await import('./importEngine');
  return run(bytes, filename, options);
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
