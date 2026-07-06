import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  artist: text('artist').notNull().default(''),
  originalKey: text('original_key'),
  capo: integer('capo').default(0),
  tempo: integer('tempo'),
  durationSeconds: integer('duration_seconds').default(90),
  copyright: text('copyright'),
  sourceProvider: text('source_provider'),
  sourceUrl: text('source_url'),
  contentAst: text('content_ast').notNull(),
  folderId: text('folder_id'),
  syncStatus: text('sync_status').notNull().default('local'),
  cloudPath: text('cloud_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const setlists = sqliteTable('setlists', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  eventDate: text('event_date'),
  notes: text('notes'),
  syncStatus: text('sync_status').notNull().default('local'),
  cloudPath: text('cloud_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const setlistItems = sqliteTable('setlist_items', {
  id: text('id').primaryKey(),
  setlistId: text('setlist_id').notNull(),
  sortOrder: integer('sort_order').notNull(),
  itemType: text('item_type').notNull(),
  songId: text('song_id'),
  noteContent: text('note_content'),
  timerSeconds: integer('timer_seconds'),
  overrideTranspose: integer('override_transpose').default(0),
  overrideCapo: integer('override_capo'),
  overrideKey: text('override_key'),
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

export type SongRow = typeof songs.$inferSelect;
export type SetlistRow = typeof setlists.$inferSelect;
export type SetlistItemRow = typeof setlistItems.$inferSelect;
