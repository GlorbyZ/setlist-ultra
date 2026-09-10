export const PERSONAL_WORKSPACE_ID = 'ws-personal';
export const DOMAIN_SCHEMA_VERSION = 2;
export const OUTBOX_SCHEMA_VERSION = 1;
export const CHART_REVISION_SCHEMA_VERSION = 1;

export function bandWorkspaceId(orgId: string): string {
  return `ws-org-${orgId}`;
}

export type OutboxOperationType =
  | 'arrangement.create'
  | 'arrangement.update'
  | 'arrangement.delete'
  | 'setlist.create'
  | 'setlist.update'
  | 'setlist.delete'
  | 'setlist.item.upsert'
  | 'setlist.item.delete'
  | 'setlist.items.reorder';

export type OutboxOperation = {
  operationId: string;
  workspaceId: string;
  entityId: string;
  operationType: OutboxOperationType;
  expectedServerRevision: number | null;
  localRevision: number;
  schemaVersion: number;
  payload: unknown;
  createdAt: string;
};
