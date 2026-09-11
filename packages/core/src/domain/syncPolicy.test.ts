import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bindHostedLibrarySong,
  firstEmbedded,
  indexSongsByRemoteLibraryId,
  isArrangementConflict,
  isLocallyDirty,
  shouldApplyRemoteSetItems,
  shouldPushEntity,
  shouldRelinkRemoteSetItems,
  setlistSongSlotIsBroken,
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

test('unlinked set songs relink even when the local set is dirty', () => {
  assert.equal(shouldRelinkRemoteSetItems({ localSyncStatus: 'local' }), false);
  assert.equal(shouldRelinkRemoteSetItems({ localSyncStatus: 'local', hasUnlinkedSongItems: true }), true);
  assert.equal(shouldRelinkRemoteSetItems({ localSyncStatus: 'synced', hasUnlinkedSongItems: false }), true);
});

test('setlist song slots are broken when the song id is missing or not in the library', () => {
  const live = new Set(['a']);
  assert.equal(setlistSongSlotIsBroken({ itemType: 'note' }, live), false);
  assert.equal(setlistSongSlotIsBroken({ itemType: 'song', songId: 'a' }, live), false);
  assert.equal(setlistSongSlotIsBroken({ itemType: 'song', songId: null }, live), true);
  assert.equal(setlistSongSlotIsBroken({ itemType: 'song', songId: 'gone' }, live), true);
});

test('hosted library id maps keep every remote id when two remotes share a local song', () => {
  const libraryIdBySong = new Map<string, string>();
  const songByRemoteLibraryId = new Map<string, string>();
  bindHostedLibrarySong(libraryIdBySong, songByRemoteLibraryId, 'local-a', 'remote-1');
  bindHostedLibrarySong(libraryIdBySong, songByRemoteLibraryId, 'local-a', 'remote-2');
  assert.equal(songByRemoteLibraryId.get('remote-1'), 'local-a');
  assert.equal(songByRemoteLibraryId.get('remote-2'), 'local-a');
  assert.equal(libraryIdBySong.get('local-a'), 'remote-2');
});

test('indexSongsByRemoteLibraryId rebuilds joins from local remote ids', () => {
  const map = indexSongsByRemoteLibraryId([
    { id: 'a', remoteId: 'r1' },
    { id: 'b', remoteId: null },
    { id: 'c', remoteId: 'r2' },
  ]);
  assert.equal(map.get('r1'), 'a');
  assert.equal(map.get('r2'), 'c');
  assert.equal(map.has(''), false);
});

test('firstEmbedded accepts a row or a one-element array', () => {
  assert.deepEqual(firstEmbedded({ chordpro: 'x' }), { chordpro: 'x' });
  assert.deepEqual(firstEmbedded([{ chordpro: 'x' }]), { chordpro: 'x' });
  assert.equal(firstEmbedded(null), null);
  assert.equal(firstEmbedded([]), null);
});

test('dirty local arrangement with a different remote hash is a conflict', () => {
  assert.equal(isArrangementConflict(true, 'aaa', 'bbb'), true);
  assert.equal(isArrangementConflict(true, 'aaa', 'aaa'), false);
  assert.equal(isArrangementConflict(false, 'aaa', 'bbb'), false);
});
