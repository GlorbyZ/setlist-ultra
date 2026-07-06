import { desc, eq } from 'drizzle-orm';
import type { SongDocument } from '@setlist-ultra/core';
import { normalizeUgTab } from '@setlist-ultra/core';
import type { UgTabResponse } from '@setlist-ultra/core';
import { setlistItems, setlists, songs } from '@setlist-ultra/db';
import { getDatabase } from './db';

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

export async function listSongs() {
  const db = await getDatabase();
  return db.select().from(songs).orderBy(desc(songs.updatedAt));
}

export async function getSong(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function saveSongFromUg(tab: UgTabResponse, sourceUrl: string) {
  const db = await getDatabase();
  const { document, meta } = normalizeUgTab(tab, sourceUrl);
  const id = newId();
  const timestamp = now();

  await db.insert(songs).values({
    id,
    title: meta.title,
    artist: meta.artist,
    originalKey: meta.originalKey,
    capo: meta.capo ?? 0,
    durationSeconds: 90,
    sourceProvider: 'ultimate_guitar',
    sourceUrl: meta.sourceUrl,
    contentAst: JSON.stringify(document),
    syncStatus: 'local',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return id;
}

export async function deleteSong(id: string) {
  const db = await getDatabase();
  await db.delete(songs).where(eq(songs.id, id));
}

export function parseSongDocument(row: { contentAst: string }): SongDocument {
  return JSON.parse(row.contentAst) as SongDocument;
}

export async function listSetlists() {
  const db = await getDatabase();
  return db.select().from(setlists).orderBy(desc(setlists.eventDate), desc(setlists.updatedAt));
}

export async function getSetlist(id: string) {
  const db = await getDatabase();
  const rows = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSetlistItems(setlistId: string) {
  const db = await getDatabase();
  return db
    .select()
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(setlistItems.sortOrder);
}

export async function createSetlist(title: string) {
  const db = await getDatabase();
  const id = newId();
  const timestamp = now();

  await db.insert(setlists).values({
    id,
    title,
    eventDate: timestamp.slice(0, 10),
    syncStatus: 'local',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return id;
}

export async function addSongToSetlist(setlistId: string, songId: string) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();

  await db.insert(setlistItems).values({
    id,
    setlistId,
    sortOrder: existing.length,
    itemType: 'song',
    songId,
    overrideTranspose: 0,
  });

  await db.update(setlists).set({ updatedAt: now() }).where(eq(setlists.id, setlistId));
}

export async function addNoteToSetlist(setlistId: string, noteContent: string) {
  const db = await getDatabase();
  const existing = await getSetlistItems(setlistId);
  const id = newId();

  await db.insert(setlistItems).values({
    id,
    setlistId,
    sortOrder: existing.length,
    itemType: 'note',
    noteContent,
    overrideTranspose: 0,
  });
}

export async function getSyncState() {
  const db = await getDatabase();
  const { syncState } = await import('@setlist-ultra/db');
  const rows = await db.select().from(syncState).limit(1);
  return rows[0] ?? null;
}

export async function saveSyncState(data: {
  provider: string;
  accountEmail?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
}) {
  const db = await getDatabase();
  const { syncState } = await import('@setlist-ultra/db');
  const existing = await getSyncState();

  if (existing) {
    await db
      .update(syncState)
      .set({
        provider: data.provider,
        accountEmail: data.accountEmail,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: data.tokenExpiry,
        lastSyncAt: now(),
      })
      .where(eq(syncState.id, 'default'));
    return;
  }

  await db.insert(syncState).values({
    id: 'default',
    provider: data.provider,
    accountEmail: data.accountEmail,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenExpiry: data.tokenExpiry,
    lastSyncAt: now(),
  });
}
