import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { fingerprintContent, md5 } from '../hash/md5';
import type {
  PackSbpOptions,
  ParsedSbpArchive,
  SbpArchiveKind,
  SbpLibrary,
  SbpSet,
  SbpSong,
} from './types';

export const SBP_FORMAT_VERSION = '1.0';

const KNOWN_SONG_KEYS = [
  'Id',
  'author',
  'Capo',
  'content',
  'hash',
  'key',
  'KeyShift',
  'name',
  'subTitle',
  'type',
  'ModifiedDateTime',
  'Deleted',
  'SyncId',
  'timeSig',
  'ZoomFactor',
  'Zoom',
  'Duration',
  'Duration2',
  '_displayParams',
  'TempoInt',
  '_tags',
  'Url',
  'DeepSearch',
  'Copyright',
  'NotesText',
  'SectionOrder',
  'SongNumber',
  'HasChildren',
  'ParentId',
  'vName',
  'locked',
  'LinkedAudio',
  'Chords',
  'midiOnLoad',
  'importSource',
  '_folders',
  'drawingPathsBackup',
] as const;

function findEntry(files: Record<string, Uint8Array>, name: string): Uint8Array | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(files)) {
    const base = key.replace(/\\/g, '/').split('/').pop() ?? key;
    if (base.toLowerCase() === lower) return value;
  }
  return undefined;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeLibrary(raw: unknown): SbpLibrary {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    songs: asArray<SbpSong>(obj.songs),
    sets: asArray<SbpSet>(obj.sets),
    folders: asArray(obj.folders),
  };
}

export function buildDataFileText(library: SbpLibrary): string {
  const payload = {
    songs: library.songs ?? [],
    sets: library.sets ?? [],
    folders: library.folders ?? [],
  };
  return `${SBP_FORMAT_VERSION}\n${JSON.stringify(payload)}`;
}

export function parseDataFileText(text: string): { version: string; library: SbpLibrary } {
  const trimmed = text.replace(/^\uFEFF/, '');
  const nl = trimmed.indexOf('\n');
  if (nl < 0) {
    throw new Error('Invalid SBP dataFile.txt: missing version line');
  }
  const version = trimmed.slice(0, nl).trim();
  const jsonText = trimmed.slice(nl + 1).trim();
  if (!jsonText) {
    throw new Error('Invalid SBP dataFile.txt: missing JSON body');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid SBP dataFile.txt: JSON parse failed');
  }
  return { version, library: normalizeLibrary(parsed) };
}

export function parseSbpArchive(bytes: Uint8Array, kindHint?: SbpArchiveKind): ParsedSbpArchive {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Not a valid SBP ZIP archive');
  }

  const dataBytes = findEntry(files, 'dataFile.txt');
  if (!dataBytes) {
    throw new Error('SBP archive missing dataFile.txt');
  }

  const dataFileText = strFromU8(dataBytes);
  const { version, library } = parseDataFileText(dataFileText);
  const expectedHash = md5(dataFileText);
  const hashBytes = findEntry(files, 'dataFile.hash');
  const hash = hashBytes ? strFromU8(hashBytes).trim().toLowerCase() : expectedHash;
  const settingsHive = findEntry(files, 'settings.hive');
  const kind: SbpArchiveKind =
    kindHint ?? (settingsHive || library.sets.length > 1 || library.songs.length > 80 ? 'backup' : 'set');

  return {
    version,
    library,
    kind,
    hash,
    hashOk: hash === expectedHash,
    settingsHive,
    dataFileText,
  };
}

export function filterLibraryForSetShare(library: SbpLibrary, setIds?: number[]): SbpLibrary {
  const sets =
    setIds && setIds.length
      ? library.sets.filter((set) => setIds.includes(Number(set.details?.Id)))
      : library.sets;
  const songIds = new Set<number>();
  for (const set of sets) {
    for (const item of set.contents ?? []) {
      if (item.SongId != null) songIds.add(Number(item.SongId));
    }
  }
  return {
    songs: library.songs.filter((song) => songIds.has(Number(song.Id))),
    sets,
    folders: library.folders ?? [],
  };
}

export function packSbpArchive(library: SbpLibrary, options: PackSbpOptions = {}): Uint8Array {
  const kind = options.kind ?? (options.settingsHive ? 'backup' : 'set');
  const filtered =
    kind === 'set' ? filterLibraryForSetShare(library, options.setIds) : library;

  const songs = filtered.songs.map(finalizeSong);
  const packed: SbpLibrary = {
    songs,
    sets: filtered.sets ?? [],
    folders: filtered.folders ?? [],
  };

  const dataFileText = buildDataFileText(packed);
  const hash = md5(dataFileText);
  const files: Record<string, Uint8Array> = {
    'dataFile.txt': strToU8(dataFileText),
    'dataFile.hash': strToU8(hash),
  };
  if (kind === 'backup' && options.settingsHive) {
    files['settings.hive'] = options.settingsHive;
  }
  return zipSync(files, { level: 6 });
}

export function finalizeSong(song: SbpSong): SbpSong {
  const content = typeof song.content === 'string' ? song.content : song.content ?? '';
  const next: SbpSong = { ...song, content, hash: fingerprintContent(content ?? '') };
  return next;
}

export function pickSongExtras(song: SbpSong): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(song)) {
    if (!(KNOWN_SONG_KEYS as readonly string[]).includes(key)) {
      extras[key] = value;
    }
  }
  return extras;
}
