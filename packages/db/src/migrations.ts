export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  artist TEXT NOT NULL DEFAULT '',
  original_key TEXT,
  capo INTEGER DEFAULT 0,
  tempo INTEGER,
  duration_seconds INTEGER DEFAULT 90,
  copyright TEXT,
  source_provider TEXT,
  source_url TEXT,
  content_ast TEXT NOT NULL,
  folder_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local',
  cloud_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT,
  notes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local',
  cloud_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlist_items (
  id TEXT PRIMARY KEY NOT NULL,
  setlist_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  song_id TEXT,
  note_content TEXT,
  timer_seconds INTEGER,
  override_transpose INTEGER DEFAULT 0,
  override_capo INTEGER,
  override_key TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  provider TEXT,
  account_email TEXT,
  root_folder_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TEXT,
  last_sync_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist ON setlist_items(setlist_id);
`;
