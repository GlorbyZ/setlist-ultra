import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isArrangementConflict,
  isLocallyDirty,
  shouldApplyRemoteSetItems,
  shouldPushEntity,
} from './syncPolicy';

test('dirty-only push skips already-synced rows', () => {
  assert.equal(shouldPushEntity('synced', 0), false);
  assert.equal(shouldPushEntity('local', 0), true);
  assert.equal(shouldPushEntity('synced', 1), true);
  assert.equal(isLocallyDirty('local'), true);
});

test('existing sets receive remote items only when local is clean', () => {
  assert.equal(shouldApplyRemoteSetItems('synced'), true);
  assert.equal(shouldApplyRemoteSetItems('local'), false);
});

test('dirty local arrangement with a different remote hash is a conflict', () => {
  assert.equal(isArrangementConflict(true, 'aaa', 'bbb'), true);
  assert.equal(isArrangementConflict(true, 'aaa', 'aaa'), false);
  assert.equal(isArrangementConflict(false, 'aaa', 'bbb'), false);
});
