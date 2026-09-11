import { and, eq, isNull, or } from 'drizzle-orm';
import {
  archiveSourceKey,
  assertImportPayload,
  detectImportFormat,
  foldArrangementTitle,
  hashImportBytes,
  parseChordPro,
  parseSbpArchive,
  sbpKeyToName,
} from '@setlist-ultra/core';
import { folders, importJobs, setlistItems, setlists, songs } from '@setlist-ultra/db';
import { getDatabase } from './db';
import { ensureWorkspaceForScope, workspaceIdForScope, type LibraryScope } from './domain';
import { persistMediaFile } from './mediaStore';
import {
  findSongByTitleArtist,
  getImportJob,
  getLibraryScope,
  getSetlistItems,
  insertLibrarySongResult,
  listResumableImports,
  listSetlists,
  newId,
  nextSbpIds,
  now,
  patchAppState,
  uint8ToB64,
  type ImportArchiveResult,
  type ImportOptions,
  type ImportProgressEvent,
} from './repository';

type Checkpoint = {
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

type CreatedIds = { songs: string[]; sets: string[]; folders: string[] };

function emptyCheckpoint(): Checkpoint {
  return {
    processedSongs: 0,
    nextSetIndex: 0,
    nextFolderIndex: 0,
    songIdMap: {},
    created: 0,
    reused: 0,
    variants: 0,
    skipped: 0,
    failed: 0,
  };
}

function readCheckpoint(raw?: string | null): Checkpoint {
  if (!raw) return emptyCheckpoint();
  try {
    return { ...emptyCheckpoint(), ...(JSON.parse(raw) as Partial<Checkpoint>) };
  } catch {
    return emptyCheckpoint();
  }
}

function readCreated(raw?: string | null): CreatedIds {
  if (!raw) return { songs: [], sets: [], folders: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<CreatedIds>;
    return {
      songs: Array.isArray(parsed.songs) ? parsed.songs : [],
      sets: Array.isArray(parsed.sets) ? parsed.sets : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    };
  } catch {
    return { songs: [], sets: [], folders: [] };
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error('Import cancelled');
  error.name = 'AbortError';
  throw error;
}

function extrasRecord(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function findSetByArchiveSource(
  workspaceId: string,
  archiveHash: string,
  sourceSbpId: number,
  jobId: string,
) {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(setlists)
    .where(
      and(
        eq(setlists.workspaceId, workspaceId),
        eq(setlists.deleted, 0),
        or(isNull(setlists.importJobId), eq(setlists.importJobId, jobId)),
      ),
    );
  return (
    rows.find((row) => {
      const extras = extrasRecord(row.extras);
      return extras.sourceArchive === archiveHash && Number(extras.sourceSbpId) === sourceSbpId;
    }) ?? null
  );
}

async function findSetByTitleAndSongs(title: string, mappedSongIds: Array<string | null | undefined>) {
  const want = mappedSongIds.filter(Boolean).join('\n');
  const titleKey = foldArrangementTitle(title);
  if (!titleKey) return null;
  const rows = await listSetlists();
  for (const row of rows) {
    if (foldArrangementTitle(row.title) !== titleKey) continue;
    const items = await getSetlistItems(row.id);
    const got = items
      .filter((item) => item.itemType === 'song')
      .map((item) => item.songId)
      .filter(Boolean)
      .join('\n');
    if (got === want && want) return row;
  }
  return null;
}

async function findFolderByArchiveSource(
  workspaceId: string,
  archiveHash: string,
  sourceFolderId: number | string,
  jobId: string,
) {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.workspaceId, workspaceId),
        or(isNull(folders.importJobId), eq(folders.importJobId, jobId)),
      ),
    );
  return (
    rows.find((row) => {
      const extras = extrasRecord(row.extras);
      return extras.sourceArchive === archiveHash && String(extras.sourceFolderId) === String(sourceFolderId);
    }) ?? null
  );
}

async function persistJob(
  jobId: string,
  patch: {
    status?: ImportProgressEvent['status'];
    checkpoint?: Checkpoint;
    createdIds?: CreatedIds;
    report?: ImportArchiveResult;
    errorText?: string | null;
  },
) {
  const db = await getDatabase();
  await db
    .update(importJobs)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.checkpoint ? { checkpointJson: JSON.stringify(patch.checkpoint) } : {}),
      ...(patch.createdIds ? { createdIdsJson: JSON.stringify(patch.createdIds) } : {}),
      ...(patch.report ? { reportJson: JSON.stringify(patch.report) } : {}),
      ...(patch.errorText !== undefined ? { errorText: patch.errorText } : {}),
      updatedAt: now(),
    })
    .where(eq(importJobs.id, jobId));
}

async function promoteJob(jobId: string) {
  const db = await getDatabase();
  await db.update(songs).set({ importJobId: null }).where(eq(songs.importJobId, jobId));
  await db.update(setlists).set({ importJobId: null }).where(eq(setlists.importJobId, jobId));
  await db.update(folders).set({ importJobId: null }).where(eq(folders.importJobId, jobId));
}

export async function importSbpArchive(
  bytes: Uint8Array,
  filename?: string,
  scope?: LibraryScope,
  options?: ImportOptions,
): Promise<ImportArchiveResult> {
  assertImportPayload(bytes);
  throwIfAborted(options?.signal);
  const format = detectImportFormat(bytes, filename);
  const kind = format === 'sbpbackup' || filename?.toLowerCase().endsWith('.sbpbackup') ? 'backup' : 'set';
  const parsed = parseSbpArchive(bytes, kind);
  const s = scope ?? (await getLibraryScope());
  await ensureWorkspaceForScope(s);
  const workspaceId = workspaceIdForScope(s);
  const archiveHash = hashImportBytes(bytes);
  const db = await getDatabase();

  const paused = (await listResumableImports()).find((job) => job.archiveHash === archiveHash && job.workspaceId === workspaceId);
  let jobId = paused?.id;
  if (!jobId) {
    jobId = newId();
    await db.insert(importJobs).values({
      id: jobId,
      workspaceId,
      filename: filename ?? null,
      format,
      archiveHash,
      status: 'running',
      checkpointJson: JSON.stringify(emptyCheckpoint()),
      createdIdsJson: JSON.stringify({ songs: [], sets: [], folders: [] }),
      createdAt: now(),
      updatedAt: now(),
    });
  } else {
    await persistJob(jobId, { status: 'running', errorText: null });
  }

  const job = await getImportJob(jobId);
  const checkpoint = readCheckpoint(job?.checkpointJson);
  const createdIds = readCreated(job?.createdIdsJson);
  const idMap = new Map<number, string>(
    Object.entries(checkpoint.songIdMap).map(([key, value]) => [Number(key), value]),
  );

  let created = checkpoint.created;
  let reused = checkpoint.reused;
  let variants = checkpoint.variants;
  let skipped = checkpoint.skipped;
  let failed = checkpoint.failed;
  let processedSongs = checkpoint.processedSongs;
  const totalSongs = parsed.library.songs.length;
  const totalSets = parsed.library.sets.length;
  const totalFolders = (parsed.library.folders ?? []).length;

  const snapshot = (): Checkpoint => ({
    processedSongs,
    nextSetIndex: checkpoint.nextSetIndex,
    nextFolderIndex: checkpoint.nextFolderIndex,
    songIdMap: Object.fromEntries([...idMap.entries()].map(([key, value]) => [String(key), value])),
    created,
    reused,
    variants,
    skipped,
    failed,
  });

  const emit = (phase: ImportProgressEvent['phase'], currentTitle?: string, status: ImportProgressEvent['status'] = 'running') => {
    options?.onProgress?.({
      phase,
      totalSongs,
      processedSongs,
      created,
      reused,
      variants,
      skipped,
      failed,
      totalSets,
      processedSets: checkpoint.nextSetIndex,
      totalFolders,
      processedFolders: checkpoint.nextFolderIndex,
      currentTitle,
      jobId,
      status,
    });
  };

  const persist = async (status: ImportProgressEvent['status'] = 'running') => {
    await persistJob(jobId, { status, checkpoint: snapshot(), createdIds });
  };

  try {
    emit('songs');
    throwIfAborted(options?.signal);

    if (parsed.settingsHive && processedSongs === 0 && checkpoint.nextSetIndex === 0) {
      await patchAppState({ settingsHiveB64: uint8ToB64(parsed.settingsHive) });
    }

    for (let index = processedSongs; index < parsed.library.songs.length; index += 1) {
      throwIfAborted(options?.signal);
      const song = parsed.library.songs[index];
      const title = song?.name || 'Untitled';
      emit('songs', title);
      if (!song || song.Deleted) {
        skipped += 1;
        processedSongs += 1;
        continue;
      }
      try {
        const sameTitle = await findSongByTitleArtist(title, song.author || '', s, jobId);
        const result = await insertLibrarySongResult({
          title,
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
              : 'sbp-archive',
          sourceUrl: typeof song.Url === 'string' ? song.Url : null,
          sourceExternalId: archiveSourceKey(archiveHash, 'song', Number(song.Id)),
          scope: s,
          allocateLocalSbpId: true,
          importJobId: jobId,
        });
        idMap.set(Number(song.Id), result.id);
        if (result.outcome === 'reused') reused += 1;
        else {
          created += 1;
          createdIds.songs.push(result.id);
          if (sameTitle) variants += 1;
        }
      } catch {
        failed += 1;
      }
      processedSongs += 1;
      if (processedSongs % 8 === 0) await persist();
    }
    await persist();

    emit('folders');
    for (let index = checkpoint.nextFolderIndex; index < (parsed.library.folders ?? []).length; index += 1) {
      throwIfAborted(options?.signal);
      const folder = parsed.library.folders[index];
      const sourceFolderId = folder?.Id ?? index;
      emit('folders', folder?.name || 'Folder');
      const existingFolder = await findFolderByArchiveSource(workspaceId, archiveHash, sourceFolderId, jobId);
      if (existingFolder) {
        checkpoint.nextFolderIndex = index + 1;
        continue;
      }
      const { songStart: folderSbpId } = await nextSbpIds(1, 0, 0);
      const folderId = newId();
      const timestamp = now();
      await db.insert(folders).values({
        id: folderId,
        sbpId: folderSbpId,
        name: folder?.name || 'Folder',
        libraryKind: s.libraryKind,
        orgId: s.orgId ?? null,
        workspaceId,
        extras: JSON.stringify({ ...(folder ?? {}), sourceArchive: archiveHash, sourceFolderId }),
        importJobId: jobId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      createdIds.folders.push(folderId);
      checkpoint.nextFolderIndex = index + 1;
      await persist();
    }

    emit('sets');
    for (let index = checkpoint.nextSetIndex; index < parsed.library.sets.length; index += 1) {
      throwIfAborted(options?.signal);
      const set = parsed.library.sets[index];
      const details = set.details ?? { Id: 0 };
      emit('sets', details.name || 'Untitled set');
      const mappedSongs = (set.contents ?? []).map((item) =>
        item.SongId != null ? idMap.get(Number(item.SongId)) : undefined,
      );
      const existingSet =
        (await findSetByArchiveSource(workspaceId, archiveHash, Number(details.Id), jobId)) ??
        (await findSetByTitleAndSongs(details.name || 'Untitled set', mappedSongs));
      if (existingSet) {
        checkpoint.nextSetIndex = index + 1;
        await persist();
        continue;
      }
      const { setStart, itemStart } = await nextSbpIds(0, 1, set.contents?.length ?? 0);
      const setUuid = newId();
      const timestamp = now();
      await db.insert(setlists).values({
        id: setUuid,
        libraryKind: s.libraryKind,
        orgId: s.orgId ?? null,
        workspaceId,
        localRevision: 1,
        importJobId: jobId,
        sbpId: setStart,
        syncId: details.SyncId ?? newId(),
        title: details.name || 'Untitled set',
        eventDate: details.date ?? timestamp.slice(0, 10),
        pinned: details.pinned ? 1 : 0,
        deleted: details.Deleted ? 1 : 0,
        extras: JSON.stringify({ ...set, sourceSbpId: details.Id, sourceArchive: archiveHash }),
        syncStatus: 'local',
        createdAt: typeof details.ModifiedDateTime === 'string' ? details.ModifiedDateTime : timestamp,
        updatedAt: timestamp,
      });
      createdIds.sets.push(setUuid);

      for (const [itemIndex, item] of (set.contents ?? []).entries()) {
        const songUuid = item.SongId != null ? idMap.get(Number(item.SongId)) : undefined;
        await db.insert(setlistItems).values({
          id: newId(),
          setlistId: setUuid,
          sbpId: itemStart + itemIndex,
          syncId: item.SyncId ?? newId(),
          sortOrder: item.Order ?? itemIndex,
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
      }
      checkpoint.nextSetIndex = index + 1;
      await persist();
    }

    await promoteJob(jobId);
    const report: ImportArchiveResult = {
      songs: created + reused,
      sets: parsed.library.sets.length,
      folders: parsed.library.folders.length,
      created,
      reused,
      variants,
      skipped,
      failed,
      hashOk: parsed.hashOk,
      kind: parsed.kind,
      jobId,
      status: 'completed',
    };
    await persistJob(jobId, { status: 'completed', checkpoint: snapshot(), createdIds, report, errorText: null });
    emit('done', undefined, 'completed');
    return report;
  } catch (error) {
    const cancelled = error instanceof Error && error.name === 'AbortError';
    await persistJob(jobId, {
      status: cancelled ? 'paused' : 'failed',
      checkpoint: snapshot(),
      createdIds,
      errorText: cancelled ? null : error instanceof Error ? error.message : String(error),
    });
    emit(cancelled ? 'songs' : 'done', undefined, cancelled ? 'paused' : 'failed');
    throw error;
  }
}

export async function importAnyChartFile(bytes: Uint8Array, filename?: string, options?: ImportOptions) {
  assertImportPayload(bytes);
  throwIfAborted(options?.signal);
  const format = detectImportFormat(bytes, filename);
  if (format === 'pdf') {
    throwIfAborted(options?.signal);
    const hash = hashImportBytes(bytes);
    const title = (filename ?? 'PDF chart').replace(/\.pdf$/i, '') || 'PDF chart';
    const uri = await persistMediaFile('pdf', bytes, 'pdf', hash);
    const chordpro = `{title: ${title}}\n{comment: PDF chart. Open with a PDF app — in-app annotation is not in this build.}`;
    const inserted = await insertLibrarySongResult({
      title,
      artist: '',
      chordpro,
      contentKind: 'pdf',
      mediaUri: uri,
      importSource: 'pdf',
      sourceProvider: 'pdf',
      sourceExternalId: hash,
    });
    options?.onProgress?.({
      phase: 'done',
      totalSongs: 1,
      processedSongs: 1,
      created: inserted.outcome === 'created' ? 1 : 0,
      reused: inserted.outcome === 'reused' ? 1 : 0,
      variants: 0,
      skipped: 0,
      failed: 0,
      currentTitle: title,
      status: 'completed',
    });
    return {
      kind: 'song' as const,
      songId: inserted.id,
      songs: 1,
      sets: 0,
      folders: 0,
      created: inserted.outcome === 'created' ? 1 : 0,
      reused: inserted.outcome === 'reused' ? 1 : 0,
      variants: 0,
      skipped: 0,
      failed: 0,
      hashOk: true,
      status: 'completed' as const,
    };
  }
  if (format === 'unknown') {
    throw new Error('This file is not a Songbook Pro archive or ChordPro chart.');
  }
  if (format === 'sbp' || format === 'sbpbackup') {
    const result = await importSbpArchive(bytes, filename, undefined, options);
    return { ...result, kind: 'archive' as const, songId: undefined as string | undefined };
  }

  throwIfAborted(options?.signal);
  const text = new TextDecoder().decode(bytes);
  const parsed = parseChordPro(text);
  options?.onProgress?.({
    phase: 'songs',
    totalSongs: 1,
    processedSongs: 0,
    created: 0,
    reused: 0,
    variants: 0,
    skipped: 0,
    failed: 0,
    currentTitle: parsed.meta.title || filename,
  });
  const inserted = await insertLibrarySongResult({
    title: parsed.meta.title || (filename ?? 'Imported').replace(/\.[^.]+$/, ''),
    artist: parsed.meta.artist || '',
    originalKey: parsed.meta.key,
    capo: parsed.meta.capo,
    tempo: parsed.meta.tempo,
    chordpro: text,
    document: parsed.document,
    importSource: format === 'onsong' ? 'onsong' : 'editor',
    sourceProvider: format === 'onsong' ? 'onsong' : 'chordpro',
  });
  options?.onProgress?.({
    phase: 'done',
    totalSongs: 1,
    processedSongs: 1,
    created: inserted.outcome === 'created' ? 1 : 0,
    reused: inserted.outcome === 'reused' ? 1 : 0,
    variants: 0,
    skipped: 0,
    failed: 0,
    currentTitle: parsed.meta.title || filename,
    status: 'completed',
  });
  return {
    kind: 'song' as const,
    songId: inserted.id,
    songs: 1,
    sets: 0,
    folders: 0,
    created: inserted.outcome === 'created' ? 1 : 0,
    reused: inserted.outcome === 'reused' ? 1 : 0,
    variants: 0,
    skipped: 0,
    failed: 0,
    hashOk: true,
    status: 'completed' as const,
  };
}
