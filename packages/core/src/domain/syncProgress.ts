export type SyncPhase = 'session' | 'push-songs' | 'pull-songs' | 'push-sets' | 'pull-sets' | 'done';

export type SyncProgressEvent = {
  phase: SyncPhase;
  done: number;
  total: number;
  pushedSongs: number;
  pulledSongs: number;
  skippedSongs: number;
  conflicts: number;
  pushedSets: number;
  pulledSets: number;
};

export const EMPTY_SYNC_PROGRESS: SyncProgressEvent = {
  phase: 'session',
  done: 0,
  total: 0,
  pushedSongs: 0,
  pulledSongs: 0,
  skippedSongs: 0,
  conflicts: 0,
  pushedSets: 0,
  pulledSets: 0,
};

/** Null when totals are not known yet — UI should stay indeterminate. */
export function syncProgressRatio(done: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, done / total));
}

export function syncPhaseLabel(phase: SyncPhase): string {
  switch (phase) {
    case 'session':
      return 'Checking account';
    case 'push-songs':
      return 'Uploading songs';
    case 'pull-songs':
      return 'Downloading songs';
    case 'push-sets':
      return 'Uploading sets';
    case 'pull-sets':
      return 'Downloading sets';
    case 'done':
      return 'Sync complete';
  }
}

export function syncCountLabel(progress: SyncProgressEvent): string {
  if (progress.phase === 'done') {
    const songs = progress.pulledSongs + progress.pushedSongs;
    const sets = progress.pulledSets + progress.pushedSets;
    if (songs === 0 && sets === 0) return 'Library is up to date';
    return `${songs} song${songs === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`;
  }
  if (progress.total <= 0) return 'Starting…';
  return `${progress.done} of ${progress.total}`;
}

export function syncSummaryLines(progress: SyncProgressEvent): string[] {
  const lines = [
    `${progress.pulledSongs} song${progress.pulledSongs === 1 ? '' : 's'} downloaded`,
    `${progress.pushedSongs} uploaded`,
    `${progress.pulledSets} set${progress.pulledSets === 1 ? '' : 's'} downloaded`,
    `${progress.pushedSets} uploaded`,
  ];
  if (progress.conflicts) {
    lines.push(
      `${progress.conflicts} local edit${progress.conflicts === 1 ? '' : 's'} kept · cloud chart saved as another revision`,
    );
  }
  return lines;
}
