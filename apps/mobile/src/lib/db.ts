import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { MIGRATION_SQL } from '@setlist-ultra/db';
import * as schema from '@setlist-ultra/db';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/** Keep a strong ref — drizzle's expo driver calls prepareSync on this native object. */
let nativeDb: SQLite.SQLiteDatabase | null = null;
let dbInstance: DrizzleDb | null = null;
let opening: Promise<DrizzleDb> | null = null;

export function isNativeDbDead(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /prepareSync|NullPointerException|NativeDatabase|database is closed|Cannot read property/i.test(message);
}

async function openDatabase(): Promise<DrizzleDb> {
  const sqlite = await SQLite.openDatabaseAsync('setlist-ultra-v2.db');
  nativeDb = sqlite;
  const statements = MIGRATION_SQL.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sqlite.execAsync(statement);
  }
  try {
    await sqlite.execAsync(
      `ALTER TABLE app_state ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'ultra-light'`,
    );
  } catch {
    /* column already exists */
  }
  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export async function resetDatabase() {
  const previous = nativeDb;
  nativeDb = null;
  dbInstance = null;
  opening = null;
  try {
    await previous?.closeAsync();
  } catch {
    /* already invalidated */
  }
}

export async function getDatabase() {
  if (dbInstance) return dbInstance;
  if (opening) return opening;
  opening = openDatabase();
  try {
    return await opening;
  } catch (error) {
    dbInstance = null;
    nativeDb = null;
    throw error;
  } finally {
    opening = null;
  }
}

/** Re-open once if expo-sqlite's native handle was nulled (Android prepareSync NPE). */
export async function recoverDatabase() {
  await resetDatabase();
  return getDatabase();
}

export type Database = Awaited<ReturnType<typeof getDatabase>>;
