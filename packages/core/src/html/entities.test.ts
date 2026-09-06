import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeHtmlEntities, foldUgName, namesLikelyMatch, ugTabIdFromUrl } from './entities';

test('decodeHtmlEntities turns UG apostrophes into real quotes', () => {
  assert.equal(decodeHtmlEntities("Guns N&#039; Roses"), "Guns N' Roses");
  assert.equal(decodeHtmlEntities("She&#39;s got a smile"), "She's got a smile");
  assert.equal(decodeHtmlEntities("Sweet Child O&apos; Mine"), "Sweet Child O' Mine");
  assert.equal(decodeHtmlEntities('A &amp; B'), 'A & B');
});

test('ugTabIdFromUrl reads the numeric tab id', () => {
  assert.equal(ugTabIdFromUrl('https://tabs.ultimate-guitar.com/tab/guns-n-roses/sweet-child-o-mine-chords-226'), '226');
  assert.equal(ugTabIdFromUrl('https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-1'), '1');
});

test('namesLikelyMatch ignores apostrophes', () => {
  assert.equal(namesLikelyMatch("Sweet Child O' Mine", 'Sweet Child O Mine'), true);
  assert.equal(namesLikelyMatch("Don't Cry", "Sweet Child O' Mine"), false);
});

test('foldUgName strips entity leftovers', () => {
  assert.equal(foldUgName("Guns N&#039; Roses"), 'guns n roses');
});
