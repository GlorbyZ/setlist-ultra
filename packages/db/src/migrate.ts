import { MIGRATION_SQL } from './migrations';

export const SCHEMA_VERSION = 3;
export const PERSONAL_WORKSPACE_ID = 'ws-personal';

export function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

export const MIGRATION_V2_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    org_id TEXT,
    account_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    account_id TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chart_revisions (
    id TEXT PRIMARY KEY NOT NULL,
    arrangement_id TEXT NOT NULL,
    chart_id TEXT,
    content_hash TEXT,
    chordpro TEXT NOT NULL DEFAULT '',
    ast TEXT,
    parent_revision_id TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS outbox_operations (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    expected_server_revision INTEGER,
    local_revision INTEGER NOT NULL DEFAULT 1,
    schema_version INTEGER NOT NULL DEFAULT 1,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_checkpoints (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT,
    workspace_id TEXT NOT NULL,
    cursor TEXT,
    updated_at TEXT NOT NULL
  )`,
  `ALTER TABLE songs ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE songs ADD COLUMN revision_id TEXT`,
  `ALTER TABLE songs ADD COLUMN local_revision INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE setlists ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE setlists ADD COLUMN local_revision INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE folders ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE app_state ADD COLUMN current_workspace_id TEXT`,
  `INSERT OR IGNORE INTO workspaces (id, kind, name, created_at, updated_at)
    VALUES ('${PERSONAL_WORKSPACE_ID}', 'personal', 'Personal', datetime('now'), datetime('now'))`,
  `INSERT OR IGNORE INTO workspaces (id, kind, name, org_id, created_at, updated_at)
    SELECT 'ws-org-' || id, 'band', COALESCE(name, 'Band'), id, datetime('now'), datetime('now') FROM orgs`,
  `INSERT OR IGNORE INTO workspaces (id, kind, name, org_id, created_at, updated_at)
    SELECT 'ws-org-' || org_id, 'band', 'Band', org_id, datetime('now'), datetime('now')
    FROM (SELECT DISTINCT org_id FROM songs WHERE org_id IS NOT NULL)`,
  `INSERT OR IGNORE INTO workspaces (id, kind, name, org_id, created_at, updated_at)
    SELECT 'ws-org-' || org_id, 'band', 'Band', org_id, datetime('now'), datetime('now')
    FROM (SELECT DISTINCT org_id FROM setlists WHERE org_id IS NOT NULL)`,
  `UPDATE songs SET workspace_id = '${PERSONAL_WORKSPACE_ID}'
    WHERE workspace_id IS NULL AND (library_kind IS NULL OR library_kind != 'org' OR org_id IS NULL)`,
  `UPDATE songs SET workspace_id = 'ws-org-' || org_id
    WHERE workspace_id IS NULL AND library_kind = 'org' AND org_id IS NOT NULL`,
  `UPDATE setlists SET workspace_id = '${PERSONAL_WORKSPACE_ID}'
    WHERE workspace_id IS NULL AND (library_kind IS NULL OR library_kind != 'org' OR org_id IS NULL)`,
  `UPDATE setlists SET workspace_id = 'ws-org-' || org_id
    WHERE workspace_id IS NULL AND library_kind = 'org' AND org_id IS NOT NULL`,
  `UPDATE folders SET workspace_id = '${PERSONAL_WORKSPACE_ID}'
    WHERE workspace_id IS NULL AND (library_kind IS NULL OR library_kind != 'org' OR org_id IS NULL)`,
  `UPDATE folders SET workspace_id = 'ws-org-' || org_id
    WHERE workspace_id IS NULL AND library_kind = 'org' AND org_id IS NOT NULL`,
  `INSERT OR IGNORE INTO chart_revisions (id, arrangement_id, chart_id, content_hash, chordpro, ast, schema_version, created_at)
    SELECT 'rev-' || id, id, chart_id, content_hash, COALESCE(chordpro, ''), content_ast, 1, COALESCE(created_at, datetime('now'))
    FROM songs`,
  `UPDATE songs SET revision_id = 'rev-' || id WHERE revision_id IS NULL`,
  `UPDATE app_state SET current_workspace_id = '${PERSONAL_WORKSPACE_ID}'
    WHERE current_workspace_id IS NULL AND (current_library_kind IS NULL OR current_library_kind != 'org' OR current_org_id IS NULL)`,
  `UPDATE app_state SET current_workspace_id = 'ws-org-' || current_org_id
    WHERE current_workspace_id IS NULL AND current_library_kind = 'org' AND current_org_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_songs_workspace ON songs(workspace_id, deleted)`,
  `CREATE INDEX IF NOT EXISTS idx_setlists_workspace ON setlists(workspace_id, deleted)`,
  `CREATE INDEX IF NOT EXISTS idx_revisions_arrangement ON chart_revisions(arrangement_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_operations(status, created_at)`,
];

export const MIGRATION_V3_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    filename TEXT,
    format TEXT NOT NULL,
    archive_hash TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    checkpoint_json TEXT,
    created_ids_json TEXT,
    report_json TEXT,
    error_text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `ALTER TABLE songs ADD COLUMN import_job_id TEXT`,
  `ALTER TABLE setlists ADD COLUMN import_job_id TEXT`,
  `ALTER TABLE folders ADD COLUMN import_job_id TEXT`,
  `ALTER TABLE songs ADD COLUMN source_external_id TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_songs_import_job ON songs(import_job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_songs_source_ext ON songs(source_provider, source_external_id)`,
];

export type MigrationExecutor = {
  exec(sql: string): Promise<void> | void;
  get<T = Record<string, unknown>>(sql: string): Promise<T | undefined | null> | T | undefined | null;
};

function isIgnorableMigrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column|already exists/i.test(message);
}

export async function applyMigrations(db: MigrationExecutor) {
  for (const statement of splitSql(MIGRATION_SQL)) {
    await db.exec(statement);
  }

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const versionRow = await db.get<{ v: number | null }>('SELECT MAX(version) as v FROM schema_migrations');
  let current = versionRow?.v ?? 0;
  if (!current) {
    const songs = await db.get<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='songs'`,
    );
    current = songs?.name ? 1 : 0;
    if (current === 1) {
      await db.exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))`);
    }
  }
  if (current < 1) {
    await db.exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))`);
    current = 1;
  }

  if (current < 2) {
    for (const statement of MIGRATION_V2_STATEMENTS) {
      try {
        await db.exec(statement);
      } catch (error) {
        if (!isIgnorableMigrationError(error)) throw error;
      }
    }
    await db.exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (2, datetime('now'))`);
  }

  if (current < 3) {
    for (const statement of MIGRATION_V3_STATEMENTS) {
      try {
        await db.exec(statement);
      } catch (error) {
        if (!isIgnorableMigrationError(error)) throw error;
      }
    }
    await db.exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (3, datetime('now'))`);
  }
}
