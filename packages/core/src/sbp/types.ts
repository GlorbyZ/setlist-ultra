/** Songbook Pro 1.0 archive JSON. Unknown keys stay on the object for round-trip. */

export type SbpSong = {
  Id: number;
  author?: string | null;
  Capo?: number | null;
  content?: string | null;
  hash?: string | null;
  key?: number | null;
  KeyShift?: number | null;
  name?: string | null;
  subTitle?: string | null;
  type?: number | null;
  ModifiedDateTime?: string | null;
  Deleted?: boolean | null;
  SyncId?: string | null;
  timeSig?: string | null;
  ZoomFactor?: number | null;
  Zoom?: number | null;
  Duration?: number | null;
  Duration2?: number | null;
  _displayParams?: unknown;
  TempoInt?: number | null;
  _tags?: string | null;
  Url?: string | null;
  DeepSearch?: unknown;
  Copyright?: string | null;
  NotesText?: string | null;
  SectionOrder?: string | null;
  SongNumber?: number | null;
  HasChildren?: boolean | null;
  ParentId?: number | null;
  vName?: string | null;
  locked?: boolean | null;
  LinkedAudio?: string | null;
  Chords?: unknown;
  midiOnLoad?: unknown;
  importSource?: string | null;
  _folders?: unknown;
  drawingPathsBackup?: unknown;
  [key: string]: unknown;
};

export type SbpSetDetails = {
  Id: number;
  name?: string | null;
  date?: string | null;
  ModifiedDateTime?: string | null;
  Deleted?: boolean | null;
  SyncId?: string | null;
  pinned?: boolean | null;
  [key: string]: unknown;
};

export type SbpSetItem = {
  Id?: number | null;
  Order?: number | null;
  Capo?: number | null;
  SetId?: number | null;
  SongId?: number | null;
  keyOfset?: number | null;
  NotesText?: string | null;
  SectionOrder?: string | null;
  ItemType?: number | null;
  Content?: string | null;
  drawingPathsBackup?: unknown;
  Deleted?: boolean | null;
  SyncId?: string | null;
  [key: string]: unknown;
};

export type SbpSet = {
  details: SbpSetDetails;
  contents?: SbpSetItem[];
  [key: string]: unknown;
};

export type SbpFolder = {
  Id?: number | null;
  name?: string | null;
  [key: string]: unknown;
};

export type SbpLibrary = {
  songs: SbpSong[];
  sets: SbpSet[];
  folders: SbpFolder[];
};

export type SbpArchiveKind = 'backup' | 'set';

export type ParsedSbpArchive = {
  version: string;
  library: SbpLibrary;
  kind: SbpArchiveKind;
  hash: string;
  hashOk: boolean;
  settingsHive?: Uint8Array;
  dataFileText: string;
};

export type PackSbpOptions = {
  kind?: SbpArchiveKind;
  settingsHive?: Uint8Array;
  /** When packing a `.sbp` set share, only embed these set Ids (default: all). */
  setIds?: number[];
};
