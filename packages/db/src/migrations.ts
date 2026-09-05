export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS charts (
  id TEXT PRIMARY KEY NOT NULL,
  content_hash TEXT NOT NULL,
  source_provider TEXT,
  source_external_id TEXT,
  chordpro TEXT NOT NULL DEFAULT '',
  ast TEXT,
  title TEXT,
  artist TEXT,
  original_key TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_charts_hash ON charts(content_hash);
CREATE INDEX IF NOT EXISTS idx_charts_source ON charts(source_provider, source_external_id);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY NOT NULL,
  sbp_id INTEGER,
  name TEXT NOT NULL,
  parent_id TEXT,
  library_kind TEXT NOT NULL DEFAULT 'personal',
  org_id TEXT,
  extras TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY NOT NULL,
  chart_id TEXT,
  library_kind TEXT NOT NULL DEFAULT 'personal',
  org_id TEXT,
  sbp_id INTEGER,
  sync_id TEXT,
  remote_id TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  artist TEXT NOT NULL DEFAULT '',
  original_key TEXT,
  key_int INTEGER,
  key_shift INTEGER DEFAULT 0,
  capo INTEGER DEFAULT 0,
  tempo INTEGER,
  duration_seconds INTEGER DEFAULT 90,
  duration_2 INTEGER,
  copyright TEXT,
  notes_text TEXT,
  section_order TEXT,
  tags TEXT,
  web_url TEXT,
  song_number INTEGER,
  parent_id TEXT,
  v_name TEXT,
  locked INTEGER DEFAULT 0,
  linked_audio TEXT,
  chords_json TEXT,
  midi_on_load TEXT,
  import_source TEXT,
  time_sig TEXT,
  zoom_factor TEXT,
  content_kind TEXT NOT NULL DEFAULT 'chordpro',
  source_provider TEXT,
  source_url TEXT,
  content_ast TEXT NOT NULL,
  chordpro TEXT NOT NULL DEFAULT '',
  content_hash TEXT,
  folder_id TEXT,
  media_uri TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  extras TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local',
  cloud_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY NOT NULL,
  library_kind TEXT NOT NULL DEFAULT 'personal',
  org_id TEXT,
  sbp_id INTEGER,
  sync_id TEXT,
  remote_id TEXT,
  title TEXT NOT NULL,
  event_date TEXT,
  notes TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  extras TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local',
  cloud_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlist_items (
  id TEXT PRIMARY KEY NOT NULL,
  setlist_id TEXT NOT NULL,
  sbp_id INTEGER,
  sync_id TEXT,
  sort_order INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_type_int INTEGER DEFAULT 1,
  song_id TEXT,
  note_content TEXT,
  timer_seconds INTEGER,
  override_transpose INTEGER DEFAULT 0,
  override_capo INTEGER,
  override_key TEXT,
  key_offset INTEGER DEFAULT 0,
  section_order TEXT,
  extras TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY NOT NULL,
  remote_id TEXT,
  name TEXT NOT NULL,
  invite_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  remote_user_id TEXT,
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  current_library_kind TEXT NOT NULL DEFAULT 'personal',
  current_org_id TEXT,
  current_song_id TEXT,
  current_setlist_id TEXT,
  current_set_index INTEGER DEFAULT 0,
  settings_hive_b64 TEXT,
  next_sbp_song_id INTEGER DEFAULT 1,
  next_sbp_set_id INTEGER DEFAULT 1,
  next_sbp_item_id INTEGER DEFAULT 1,
  theme_id TEXT NOT NULL DEFAULT 'ultra-light'
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
CREATE INDEX IF NOT EXISTS idx_songs_library ON songs(library_kind, org_id, deleted);
CREATE INDEX IF NOT EXISTS idx_songs_hash ON songs(content_hash);
CREATE INDEX IF NOT EXISTS idx_songs_sbp ON songs(sbp_id);
CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist ON setlist_items(setlist_id);
CREATE INDEX IF NOT EXISTS idx_setlists_library ON setlists(library_kind, org_id, deleted);
`;
