import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { MIGRATION_SQL } from './migrations';
import { applyMigrations, PERSONAL_WORKSPACE_ID, SCHEMA_VERSION, splitSql } from './migrate';

function executor(sqlite: DatabaseSync) {
  return {
    exec(sql: string) {
      sqlite.exec(sql);
    },
    get<T>(sql: string) {
      return sqlite.prepare(sql).get() as T | undefined;
    },
  };
}

test('v1 install upgrades to workspaces and chart revisions', async () => {
  const sqlite = new DatabaseSync(':memory:');
  for (const statement of splitSql(MIGRATION_SQL)) sqlite.exec(statement);
  sqlite.exec(`INSERT INTO songs (
    id, title, artist, content_ast, chordpro, content_hash, library_kind, deleted, sync_status, created_at, updated_at
  ) VALUES (
    'song-1', 'Wonderwall', 'Oasis', '{}', '{title: Wonderwall}', 'hash-1', 'personal', 0, 'local', '2026-01-01', '2026-01-01'
  )`);
  sqlite.exec(`INSERT INTO setlists (
    id, title, library_kind, deleted, sync_status, created_at, updated_at
  ) VALUES (
    'set-1', 'Friday', 'personal', 0, 'local', '2026-01-01', '2026-01-01'
  )`);

  await applyMigrations(executor(sqlite));

  const version = sqlite.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number };
  assert.equal(version.v, SCHEMA_VERSION);

  const workspace = sqlite.prepare('SELECT id, kind FROM workspaces WHERE id = ?').get(PERSONAL_WORKSPACE_ID) as {
    kind: string;
  };
  assert.equal(workspace.kind, 'personal');

  const song = sqlite.prepare('SELECT workspace_id, revision_id, local_revision FROM songs WHERE id = ?').get(
    'song-1',
  ) as {
    workspace_id: string;
    revision_id: string;
    local_revision: number;
  };
  assert.equal(song.workspace_id, PERSONAL_WORKSPACE_ID);
  assert.equal(song.revision_id, 'rev-song-1');
  assert.equal(song.local_revision, 1);

  const revision = sqlite.prepare('SELECT chordpro, arrangement_id FROM chart_revisions WHERE id = ?').get(
    'rev-song-1',
  ) as { chordpro: string; arrangement_id: string };
  assert.equal(revision.arrangement_id, 'song-1');
  assert.match(revision.chordpro, /Wonderwall/);

  const setlist = sqlite.prepare('SELECT workspace_id, local_revision FROM setlists WHERE id = ?').get('set-1') as {
    workspace_id: string;
    local_revision: number;
  };
  assert.equal(setlist.workspace_id, PERSONAL_WORKSPACE_ID);
  assert.equal(setlist.local_revision, 1);
});

test('v2 database upgrades to import jobs', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = executor(sqlite);
  await applyMigrations(db);
  const jobs = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='import_jobs'`).get() as {
    name: string;
  };
  assert.equal(jobs.name, 'import_jobs');
  const song = sqlite.prepare(`PRAGMA table_info(songs)`).all() as { name: string }[];
  assert.ok(song.some((col) => col.name === 'import_job_id'));
  assert.ok(song.some((col) => col.name === 'source_external_id'));
});

test('applyMigrations is idempotent on a v2 database', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = executor(sqlite);
  await applyMigrations(db);
  await applyMigrations(db);
  const count = sqlite.prepare('SELECT COUNT(*) as n FROM schema_migrations').get() as { n: number };
  assert.equal(count.n, SCHEMA_VERSION);
});
