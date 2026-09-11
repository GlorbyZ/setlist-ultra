import { md5 } from '@setlist-ultra/core';

import type { ValidatedProposal } from './validate';

export const AI_PROPOSAL_TTL_MS = 30 * 60 * 1000;

export type ProposalEnvelope = {
  proposalId: string;
  taskId: string;
  schemaVersion: string;
  contentHash: string;
  createdAt: string;
  expiresAt: string;
  expectedRevisions: Record<string, number>;
  assumptions: string[];
  warnings: string[];
  diffLines: string[];
  estimatedSeconds?: number;
  missingDurationIds: string[];
  body: ValidatedProposal;
};

export function hashProposalBody(body: ValidatedProposal): string {
  const canonical =
    body.kind === 'set'
      ? JSON.stringify({ kind: 'set', title: body.title, songIds: body.songIds })
      : body.kind === 'chart'
        ? JSON.stringify({ kind: 'chart', songId: body.songId ?? null, chordpro: body.chordpro })
        : JSON.stringify({ kind: 'library', songIds: body.songIds, notes: body.notes ?? '' });
  return md5(canonical);
}

export function wrapProposal(
  body: ValidatedProposal,
  options?: {
    taskId?: string;
    schemaVersion?: string;
    expectedRevisions?: Record<string, number>;
    assumptions?: string[];
    warnings?: string[];
    estimatedSeconds?: number;
    missingDurationIds?: string[];
    now?: number;
    ttlMs?: number;
  },
): ProposalEnvelope {
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? AI_PROPOSAL_TTL_MS;
  const contentHash = hashProposalBody(body);
  const warnings = [...(options?.warnings ?? [])];
  if (body.kind === 'set' && body.inventedIds.length) {
    warnings.push(`Ignored ${body.inventedIds.length} unknown song id(s).`);
  }
  if (body.uncertain) warnings.push('The model marked this proposal uncertain.');
  const diffLines = diffFromProposal(body);
  return {
    proposalId: `prop-${contentHash.slice(0, 12)}`,
    taskId: options?.taskId ?? 'task',
    schemaVersion: options?.schemaVersion ?? 'ai-proposals.v2',
    contentHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    expectedRevisions: options?.expectedRevisions ?? {},
    assumptions: options?.assumptions ?? [],
    warnings,
    diffLines,
    estimatedSeconds: options?.estimatedSeconds,
    missingDurationIds: options?.missingDurationIds ?? [],
    body,
  };
}

export function isProposalExpired(envelope: ProposalEnvelope, now = Date.now()): boolean {
  return Date.parse(envelope.expiresAt) <= now;
}

export function approvalMatches(envelope: ProposalEnvelope, contentHash: string): boolean {
  return envelope.contentHash === contentHash;
}

export function diffFromProposal(body: ValidatedProposal): string[] {
  if (body.kind === 'set') {
    return [
      `Create set “${body.title}”`,
      ...body.songs.map((song, index) => `${index + 1}. ${song.title}${song.artist ? ` — ${song.artist}` : ''}`),
    ];
  }
  if (body.kind === 'chart') {
    return [
      body.songId ? `Patch chart ${body.title ?? body.songId}` : `Create chart “${body.title || 'AI chart'}”`,
      `${body.chordpro.split('\n').length} ChordPro lines`,
    ];
  }
  return body.songs.map((song) => `${song.title}${song.artist ? ` — ${song.artist}` : ''}`);
}

export function setUndoStillSafe(currentSongIds: string[], proposedSongIds: string[]): boolean {
  if (currentSongIds.length !== proposedSongIds.length) return false;
  return currentSongIds.every((id, index) => id === proposedSongIds[index]);
}
