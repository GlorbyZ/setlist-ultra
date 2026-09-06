import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertUgTabMatchesRequest, UgVersionMismatchError } from './match';
import type { UgTabResponse } from '../ast/types';

function tab(title: string, artist: string, id: string, url: string): UgTabResponse {
  return {
    requestedUrl: url,
    tab: { title, artist_name: artist, id, tab_url: url, lines: [] },
  };
}

const sweetUrl = 'https://tabs.ultimate-guitar.com/tab/guns-n-roses/sweet-child-o-mine-chords-226';
const wonderUrl = 'https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-1';
const cryUrl = 'https://tabs.ultimate-guitar.com/tab/guns-n-roses/dont-cry-chords-99';

test('assertUgTabMatchesRequest accepts the tapped Sweet Child version', () => {
  assert.doesNotThrow(() =>
    assertUgTabMatchesRequest(tab("Sweet Child O' Mine", "Guns N' Roses", '226', sweetUrl), sweetUrl, {
      songName: 'Sweet Child O Mine',
      artistName: 'Guns N Roses',
    }),
  );
});

test('assertUgTabMatchesRequest rejects a Wonderwall payload for a Sweet Child tap', () => {
  assert.throws(
    () =>
      assertUgTabMatchesRequest(tab('Wonderwall', 'Oasis', '1', wonderUrl), sweetUrl, {
        songName: "Sweet Child O' Mine",
        artistName: "Guns N' Roses",
      }),
    UgVersionMismatchError,
  );
});

test('assertUgTabMatchesRequest rejects Dont Cry when Sweet Child was selected', () => {
  assert.throws(
    () =>
      assertUgTabMatchesRequest(tab("Don't Cry", "Guns N' Roses", '99', cryUrl), sweetUrl, {
        songName: "Sweet Child O' Mine",
        artistName: "Guns N' Roses",
      }),
    UgVersionMismatchError,
  );
});
