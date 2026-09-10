import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Deduped chart catalog — one row per unique ChordPro (and later PDF) blob. */
export const charts = sqliteTable('charts', {
  id: text('id').primaryKey(),
  contentHash: text('content_hash').notNull(),
  sourceProvider: text('source_provider'),
  sourceExternalId: text('source_external_id'),
  chordpro: text('chordpro').notNull().default(''),
  ast: text('ast'),
  title: text('title'),
  artist: text('artist'),
  originalKey: text('original_key'),
  createdAt: text('created_at').notNull(),
});

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  sbpId: integer('sbp_id'),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  libraryKind: text('library_kind').notNull().default('personal'),
  orgId: text('org_id'),
  extras: text('extras'),
  workspaceId: text('workspace_id'),
  importJobId: text('import_job_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Library membership + per-user/org overrides.
 * One chart can appear in personal and org libraries as separate rows.
 */
export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  chartId: text('chart_id'),
  libraryKind: text('library_kind').notNull().default('personal'),
  orgId: text('org_id'),
  sbpId: integer('sbp_id'),
  syncId: text('sync_id'),
  remoteId: text('remote_id'),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  artist: text('artist').notNull().default(''),
  originalKey: text('original_key'),
  keyInt: integer('key_int'),
  keyShift: integer('key_shift').default(0),
  capo: integer('capo').default(0),
  tempo: integer('tempo'),
  durationSeconds: integer('duration_seconds').default(90),
  duration2: integer('duration_2'),
  copyright: text('copyright'),
  notesText: text('notes_text'),
  sectionOrder: text('section_order'),
  tags: text('tags'),
  webUrl: text('web_url'),
  songNumber: integer('song_number'),
  parentId: text('parent_id'),
  vName: text('v_name'),
  locked: integer('locked').default(0),
  linkedAudio: text('linked_audio'),
  chordsJson: text('chords_json'),
  midiOnLoad: text('midi_on_load'),
  importSource: text('import_source'),
  timeSig: text('time_sig'),
  zoomFactor: text('zoom_factor'),
  contentKind: text('content_kind').notNull().default('chordpro'),
  sourceProvider: text('source_provider'),
  sourceUrl: text('source_url'),
  sourceExternalId: text('source_external_id'),
  contentAst: text('content_ast').notNull(),
  chordpro: text('chordpro').notNull().default(''),
  contentHash: text('content_hash'),
  folderId: text('folder_id'),
  mediaUri: text('media_uri'),
  workspaceId: text('workspace_id'),
  revisionId: text('revision_id'),
  localRevision: integer('local_revision').notNull().default(1),
  importJobId: text('import_job_id'),
  deleted: integer('deleted').notNull().default(0),
  extras: text('extras'),
  syncStatus: text('sync_status').notNull().default('local'),
  cloudPath: text('cloud_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const setlists = sqliteTable('setlists', {
  id: text('id').primaryKey(),
  libraryKind: text('library_kind').notNull().default('personal'),
  orgId: text('org_id'),
  sbpId: integer('sbp_id'),
  syncId: text('sync_id'),
  remoteId: text('remote_id'),
  title: text('title').notNull(),
  eventDate: text('event_date'),
  notes: text('notes'),
  pinned: integer('pinned').notNull().default(0),
  deleted: integer('deleted').notNull().default(0),
  extras: text('extras'),
  syncStatus: text('sync_status').notNull().default('local'),
  cloudPath: text('cloud_path'),
  workspaceId: text('workspace_id'),
  localRevision: integer('local_revision').notNull().default(1),
  importJobId: text('import_job_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const setlistItems = sqliteTable('setlist_items', {
  id: text('id').primaryKey(),
  setlistId: text('setlist_id').notNull(),
  sbpId: integer('sbp_id'),
  syncId: text('sync_id'),
  sortOrder: integer('sort_order').notNull(),
  itemType: text('item_type').notNull(),
  itemTypeInt: integer('item_type_int').default(1),
  songId: text('song_id'),
  noteContent: text('note_content'),
  timerSeconds: integer('timer_seconds'),
  overrideTranspose: integer('override_transpose').default(0),
  overrideCapo: integer('override_capo'),
  overrideKey: text('override_key'),
  keyOffset: integer('key_offset').default(0),
  sectionOrder: text('section_order'),
  extras: text('extras'),
  deleted: integer('deleted').notNull().default(0),
});

export const orgs = sqliteTable('orgs', {
  id: text('id').primaryKey(),
  remoteId: text('remote_id'),
  name: text('name').notNull(),
  inviteCode: text('invite_code'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  createdAt: text('created_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  remoteUserId: text('remote_user_id'),
  email: text('email'),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const appState = sqliteTable('app_state', {
  id: text('id').primaryKey().default('default'),
  currentLibraryKind: text('current_library_kind').notNull().default('personal'),
  currentOrgId: text('current_org_id'),
  currentWorkspaceId: text('current_workspace_id'),
  currentSongId: text('current_song_id'),
  currentSetlistId: text('current_setlist_id'),
  currentSetIndex: integer('current_set_index').default(0),
  settingsHiveB64: text('settings_hive_b64'),
  nextSbpSongId: integer('next_sbp_song_id').default(1),
  nextSbpSetId: integer('next_sbp_set_id').default(1),
  nextSbpItemId: integer('next_sbp_item_id').default(1),
  themeId: text('theme_id').notNull().default('ultra-light'),
});

export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey().default('default'),
  provider: text('provider'),
  accountEmail: text('account_email'),
  rootFolderId: text('root_folder_id'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiry: text('token_expiry'),
  lastSyncAt: text('last_sync_at'),
});

/** Guest / personal / band data boundary. Account identity is separate. */
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  orgId: text('org_id'),
  accountId: text('account_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  accountId: text('account_id'),
  email: text('email'),
  role: text('role').notNull().default('member'),
  createdAt: text('created_at').notNull(),
});

/** Immutable chart content for an arrangement. New edits insert a row; they do not overwrite. */
export const chartRevisions = sqliteTable('chart_revisions', {
  id: text('id').primaryKey(),
  arrangementId: text('arrangement_id').notNull(),
  chartId: text('chart_id'),
  contentHash: text('content_hash'),
  chordpro: text('chordpro').notNull().default(''),
  ast: text('ast'),
  parentRevisionId: text('parent_revision_id'),
  schemaVersion: integer('schema_version').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const outboxOperations = sqliteTable('outbox_operations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  operationType: text('operation_type').notNull(),
  expectedServerRevision: integer('expected_server_revision'),
  localRevision: integer('local_revision').notNull().default(1),
  schemaVersion: integer('schema_version').notNull().default(1),
  payload: text('payload'),
  status: text('status').notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const syncCheckpoints = sqliteTable('sync_checkpoints', {
  id: text('id').primaryKey(),
  accountId: text('account_id'),
  workspaceId: text('workspace_id').notNull(),
  cursor: text('cursor'),
  updatedAt: text('updated_at').notNull(),
});

export const importJobs = sqliteTable('import_jobs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  filename: text('filename'),
  format: text('format').notNull(),
  archiveHash: text('archive_hash'),
  status: text('status').notNull().default('running'),
  checkpointJson: text('checkpoint_json'),
  createdIdsJson: text('created_ids_json'),
  reportJson: text('report_json'),
  errorText: text('error_text'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: integer('version').primaryKey(),
  appliedAt: text('applied_at').notNull(),
});

export type ChartRow = typeof charts.$inferSelect;
export type SongRow = typeof songs.$inferSelect;
export type FolderRow = typeof folders.$inferSelect;
export type SetlistRow = typeof setlists.$inferSelect;
export type SetlistItemRow = typeof setlistItems.$inferSelect;
export type OrgRow = typeof orgs.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type AppStateRow = typeof appState.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type ChartRevisionRow = typeof chartRevisions.$inferSelect;
export type OutboxOperationRow = typeof outboxOperations.$inferSelect;
export type ImportJobRow = typeof importJobs.$inferSelect;
