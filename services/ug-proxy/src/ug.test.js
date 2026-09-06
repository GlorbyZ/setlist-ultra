import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tabFromStore } from './ug.js';

const sweetUrl = 'https://tabs.ultimate-guitar.com/tab/guns-n-roses/sweet-child-o-mine-chords-226';
const cryUrl = 'https://tabs.ultimate-guitar.com/tab/guns-n-roses/dont-cry-chords-99';
const wonderUrl = 'https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-1';

function storeWithRelated() {
  return {
    store: {
      page: {
        tabs: [
          {
            id: 1,
            song_name: 'Wonderwall',
            artist_name: 'Oasis',
            tab_url: wonderUrl,
            content: "[ch]F[/ch] today is gonna be the day",
          },
          {
            id: 99,
            song_name: "Don't Cry",
            artist_name: "Guns N' Roses",
            tab_url: cryUrl,
            content: "[ch]Am[/ch] Talk to me softly",
          },
          {
            id: 226,
            song_name: "Sweet Child O' Mine",
            artist_name: "Guns N&#039; Roses",
            tab_url: sweetUrl,
            content: "[ch]D[/ch] She&#039;s got a smile that it seems to me",
          },
        ],
      },
    },
  };
}

test('tabFromStore returns the requested Sweet Child tab, not related Dont Cry or Wonderwall', () => {
  const parsed = tabFromStore(storeWithRelated(), sweetUrl);
  assert.equal(parsed.tab.id, '226');
  assert.equal(parsed.tab.title, "Sweet Child O' Mine");
  assert.equal(parsed.tab.artist_name, "Guns N' Roses");
  assert.equal(parsed.tab.tab_url, sweetUrl);
  const lyric = parsed.tab.lines.find((line) => line.type === 'lyric')?.lyric ?? '';
  assert.match(lyric, /She's got a smile/);
  assert.doesNotMatch(lyric, /Talk to me softly/);
  assert.doesNotMatch(lyric, /today is gonna be the day/);
});

test('tabFromStore does not leak a sibling tab when ids differ', () => {
  const parsed = tabFromStore(storeWithRelated(), cryUrl);
  assert.equal(parsed.tab.title, "Don't Cry");
  assert.notEqual(parsed.tab.title, 'Wonderwall');
});
