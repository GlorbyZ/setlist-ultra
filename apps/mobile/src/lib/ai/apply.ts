import { addSongToSetlist, createSetlist, insertLibrarySong, updateSong } from '@/src/lib/repository';

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
