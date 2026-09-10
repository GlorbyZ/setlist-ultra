import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EMPTY_SYNC_PROGRESS,
  syncCountLabel,
  syncPhaseLabel,
  syncProgressRatio,
  syncSummaryLines,
} from './syncProgress';

test('ratio stays unknown until a real total exists', () => {
  assert.equal(syncProgressRatio(0, 0), null);
  assert.equal(syncProgressRatio(3, 10), 0.3);
  assert.equal(syncProgressRatio(12, 10), 1);
});

test('phase labels are specific work names', () => {
  assert.equal(syncPhaseLabel('pull-songs'), 'Downloading songs');
  assert.equal(syncPhaseLabel('done'), 'Sync complete');
});

test('count label uses completed-over-total once known', () => {
  assert.equal(syncCountLabel({ ...EMPTY_SYNC_PROGRESS, phase: 'push-songs' }), 'Starting…');
  assert.equal(syncCountLabel({ ...EMPTY_SYNC_PROGRESS, phase: 'pull-songs', done: 4, total: 20 }), '4 of 20');
  assert.equal(
    syncCountLabel({ ...EMPTY_SYNC_PROGRESS, phase: 'done', pulledSongs: 12, pushedSongs: 1, pulledSets: 2 }),
    '13 songs · 2 sets',
  );
});

test('summary lines report real counts', () => {
  const lines = syncSummaryLines({
    ...EMPTY_SYNC_PROGRESS,
    pulledSongs: 12,
    pushedSongs: 0,
    pulledSets: 3,
    pushedSets: 1,
    conflicts: 1,
  });
  assert.ok(lines[0]?.includes('12 songs downloaded'));
  assert.ok(lines.some((line) => line.includes('local edit')));
});
