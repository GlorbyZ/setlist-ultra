import { addSongToSetlist, createSetlist, deleteSetlist, deleteSong, getSetlist, getSetlistItems, getSong, insertLibrarySong, updateSong } from '@/src/lib/repository';

import { approvalMatches, isProposalExpired, setUndoStillSafe, type ProposalEnvelope } from './proposal';
import { assertNotOnStage } from './stageGuard';
import type { ValidatedChartPatch, ValidatedSetProposal } from './validate';

export type AppliedSet = {
  kind: 'set';
  setlistId: string;
  title: string;
  songCount: number;
};

export type AppliedChart = {
  kind: 'chart';
  songId: string;
  created: boolean;
};

export type ApplyReceipt = {
  receiptId: string;
  idempotencyKey: string;
  proposalHash: string;
  appliedAt: string;
  summary: string;
  undo?: UndoRecord;
};

export type UndoRecord =
  | { kind: 'set'; setlistId: string; expectedSongIds: string[] }
  | { kind: 'chart'; songId: string; previousChordpro: string; expectedRevision: number; created: boolean };

const receiptsByKey = new Map<string, ApplyReceipt>();
let lastReceipt: ApplyReceipt | null = null;

export function getLastAiReceipt(): ApplyReceipt | null {
  return lastReceipt;
}

export function peekReceipt(idempotencyKey: string): ApplyReceipt | undefined {
  return receiptsByKey.get(idempotencyKey);
}

/** Domain command — AI never writes library tables itself. */
export async function applySetProposal(proposal: ValidatedSetProposal): Promise<AppliedSet> {
  if (!proposal.songIds.length) {
    throw new Error('Nothing to apply — no library songs in this proposal.');
  }
  const setlistId = await createSetlist(proposal.title);
  for (const songId of proposal.songIds) {
    await addSongToSetlist(setlistId, songId);
  }
  return { kind: 'set', setlistId, title: proposal.title, songCount: proposal.songIds.length };
}

export async function applyChartPatch(proposal: ValidatedChartPatch): Promise<AppliedChart> {
  if (proposal.songId) {
    await updateSong(proposal.songId, { chordpro: proposal.chordpro });
    return { kind: 'chart', songId: proposal.songId, created: false };
  }
  const songId = await insertLibrarySong({
    title: proposal.title || 'AI chart',
    artist: proposal.artist || '',
    chordpro: proposal.chordpro,
    importSource: 'ai-preview',
  });
  return { kind: 'chart', songId, created: true };
}

export async function applyApprovedProposal(
  envelope: ProposalEnvelope,
  options: { contentHash: string; idempotencyKey?: string },
): Promise<ApplyReceipt> {
  assertNotOnStage('apply an AI proposal');
  if (isProposalExpired(envelope)) {
    throw new Error('This proposal expired. Run the task again.');
  }
  if (!approvalMatches(envelope, options.contentHash)) {
    throw new Error('Approval did not match the proposal on screen.');
  }
  const key = options.idempotencyKey || envelope.contentHash;
  const existing = receiptsByKey.get(key);
  if (existing) return existing;

  if (envelope.body.kind === 'library') {
    throw new Error('Library answers are references only — nothing to apply.');
  }

  let undo: UndoRecord | undefined;
  let summary: string;

  if (envelope.body.kind === 'set') {
    const applied = await applySetProposal(envelope.body);
    undo = { kind: 'set', setlistId: applied.setlistId, expectedSongIds: envelope.body.songIds };
    summary = `Created set “${applied.title}” with ${applied.songCount} songs.`;
  } else {
    const previous = envelope.body.songId ? await getSong(envelope.body.songId) : null;
    if (envelope.body.songId) {
      const expected = envelope.expectedRevisions[envelope.body.songId];
      if (expected != null && previous && previous.localRevision !== expected) {
        throw new Error('This chart changed since the proposal. Refresh and reconfirm.');
      }
    }
    const applied = await applyChartPatch(envelope.body);
    undo = {
      kind: 'chart',
      songId: applied.songId,
      previousChordpro: previous?.chordpro ?? '',
      expectedRevision: (previous?.localRevision ?? 0) + 1,
      created: applied.created,
    };
    summary = applied.created ? 'Saved as a new chart.' : 'Updated the existing chart.';
  }

  const receipt: ApplyReceipt = {
    receiptId: `rcpt-${Date.now().toString(36)}`,
    idempotencyKey: key,
    proposalHash: envelope.contentHash,
    appliedAt: new Date().toISOString(),
    summary,
    undo,
  };
  receiptsByKey.set(key, receipt);
  lastReceipt = receipt;
  return receipt;
}

export async function undoLastAiApply(): Promise<string> {
  assertNotOnStage('undo an AI change');
  const receipt = lastReceipt;
  if (!receipt?.undo) throw new Error('Nothing to undo.');
  const record = receipt.undo;
  if (record.kind === 'set') {
    const row = await getSetlist(record.setlistId);
    if (!row || row.deleted) throw new Error('That set is already gone.');
    const items = await getSetlistItems(record.setlistId);
    const currentIds = items.filter((item) => item.itemType === 'song').map((item) => item.songId).filter(Boolean) as string[];
    if (!setUndoStillSafe(currentIds, record.expectedSongIds)) {
      throw new Error('The set was edited after Apply. Undo would clobber those edits.');
    }
    await deleteSetlist(record.setlistId);
    lastReceipt = null;
    receiptsByKey.delete(receipt.idempotencyKey);
    return `Removed set “${row.title}”.`;
  }
  const song = await getSong(record.songId);
  if (!song) throw new Error('That chart is gone.');
  if (song.localRevision !== record.expectedRevision) {
    throw new Error('The chart was edited after Apply. Undo would clobber those edits.');
  }
  if (record.created) {
    await deleteSong(record.songId);
    lastReceipt = null;
    receiptsByKey.delete(receipt.idempotencyKey);
    return 'Removed the AI-created chart.';
  }
  await updateSong(record.songId, { chordpro: record.previousChordpro });
  lastReceipt = null;
  receiptsByKey.delete(receipt.idempotencyKey);
  return 'Restored the previous chart.';
}
