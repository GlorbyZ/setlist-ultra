import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { MIGRATION_SQL } from '@setlist-ultra/db';
import * as schema from '@setlist-ultra/db';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDatabase() {
  if (dbInstance) return dbInstance;

  const sqlite = await SQLite.openDatabaseAsync('setlist-ultra.db');
  const statements = MIGRATION_SQL.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sqlite.execAsync(statement);
  }
  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export type Database = Awaited<ReturnType<typeof getDatabase>>;
