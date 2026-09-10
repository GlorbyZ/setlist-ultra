import { and, asc, eq } from 'drizzle-orm';
import {
  bandWorkspaceId,
  OUTBOX_SCHEMA_VERSION,
  PERSONAL_WORKSPACE_ID,
  type OutboxOperationType,
} from '@setlist-ultra/core';
import { chartRevisions, outboxOperations, syncCheckpoints, workspaces } from '@setlist-ultra/db';
import { getDatabase, withTransaction } from './db';

export { PERSONAL_WORKSPACE_ID, bandWorkspaceId };

export type LibraryScope = {
  libraryKind: 'personal' | 'org';
  orgId?: string | null;
  workspaceId?: string | null;
};

export type MutationOrigin = 'user' | 'sync';

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

export function workspaceIdForScope(scope: LibraryScope): string {
  if (scope.workspaceId) return scope.workspaceId;
  if (scope.libraryKind === 'org' && scope.orgId) return bandWorkspaceId(scope.orgId);
  return PERSONAL_WORKSPACE_ID;
}

export async function ensureWorkspace(
  id: string,
  kind: 'personal' | 'band' | 'guest',
  name: string,
  orgId?: string | null,
) {
  const db = await getDatabase();
  const existing = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  if (existing[0]) return existing[0];
  const timestamp = now();
  await db.insert(workspaces).values({
    id,
    kind,
    name,
    orgId: orgId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const created = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return created[0];
}

export async function ensureWorkspaceForScope(scope: LibraryScope) {
  const id = workspaceIdForScope(scope);
  if (id === PERSONAL_WORKSPACE_ID) {
    return ensureWorkspace(id, 'personal', 'Personal');
  }
  if (scope.libraryKind === 'org' && scope.orgId) {
    return ensureWorkspace(id, 'band', 'Band', scope.orgId);
  }
  return ensureWorkspace(id, 'guest', 'Guest');
}

export async function enqueueOutbox(input: {
  workspaceId: string;
  entityId: string;
  entityType: 'arrangement' | 'setlist' | 'setlist_item';
  operationType: OutboxOperationType;
  localRevision: number;
  payload?: unknown;
  expectedServerRevision?: number | null;
}) {
  const db = await getDatabase();
  await db.insert(outboxOperations).values({
    id: newId(),
    workspaceId: input.workspaceId,
    entityId: input.entityId,
    entityType: input.entityType,
    operationType: input.operationType,
    expectedServerRevision: input.expectedServerRevision ?? null,
    localRevision: input.localRevision,
    schemaVersion: OUTBOX_SCHEMA_VERSION,
    payload: input.payload == null ? null : JSON.stringify(input.payload),
    status: 'pending',
    retryCount: 0,
    createdAt: now(),
  });
}

export async function insertChartRevision(input: {
  id?: string;
  arrangementId: string;
  chartId?: string | null;
  contentHash?: string | null;
  chordpro: string;
  ast?: string | null;
  parentRevisionId?: string | null;
}) {
  const db = await getDatabase();
  const id = input.id ?? newId();
  await db.insert(chartRevisions).values({
    id,
    arrangementId: input.arrangementId,
    chartId: input.chartId ?? null,
    contentHash: input.contentHash ?? null,
    chordpro: input.chordpro,
    ast: input.ast ?? null,
    parentRevisionId: input.parentRevisionId ?? null,
    schemaVersion: 1,
    createdAt: now(),
  });
  return id;
}

export async function commitLocal<T>(write: () => Promise<T>): Promise<T> {
  return withTransaction(write);
}

export async function listPendingOutbox(workspaceId: string) {
  const db = await getDatabase();
  return db
    .select()
    .from(outboxOperations)
    .where(and(eq(outboxOperations.workspaceId, workspaceId), eq(outboxOperations.status, 'pending')))
    .orderBy(asc(outboxOperations.createdAt));
}

export async function completeOutboxForEntity(entityId: string) {
  const db = await getDatabase();
  await db
    .update(outboxOperations)
    .set({ status: 'completed' })
    .where(and(eq(outboxOperations.entityId, entityId), eq(outboxOperations.status, 'pending')));
}

export async function getSyncCheckpoint(workspaceId: string) {
  const db = await getDatabase();
  const rows = await db.select().from(syncCheckpoints).where(eq(syncCheckpoints.workspaceId, workspaceId)).limit(1);
  return rows[0] ?? null;
}

export async function saveSyncCheckpoint(workspaceId: string, cursor: string, accountId?: string | null) {
  const db = await getDatabase();
  const existing = await getSyncCheckpoint(workspaceId);
  const timestamp = now();
  if (existing) {
    await db
      .update(syncCheckpoints)
      .set({ cursor, accountId: accountId ?? existing.accountId, updatedAt: timestamp })
      .where(eq(syncCheckpoints.id, existing.id));
    return;
  }
  await db.insert(syncCheckpoints).values({
    id: newId(),
    workspaceId,
    accountId: accountId ?? null,
    cursor,
    updatedAt: timestamp,
  });
}
