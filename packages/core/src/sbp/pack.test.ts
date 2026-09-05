import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { EMPTY_MD5, fingerprintContent, md5 } from '../hash/md5';
import { parseChordPro } from '../chordpro/parse';
import { documentToChordPro } from '../chordpro/export';
import { keyNameToSbp, sbpKeyToName } from '../key';
import { packSbpArchive, parseSbpArchive } from './pack';
import type { SbpLibrary } from './types';

const FIXTURE: SbpLibrary = {
  songs: [
    {
      Id: 1,
      name: 'Hello Chart',
      author: 'Fixture Band',
      content: '{c: Intro}\n[G]Hello [C]world\n{sot}\ne|----------------|\n{eot}\n',
      key: 7,
      KeyShift: 0,
      Capo: 0,
      type: 1,
      Deleted: false,
      SyncId: '11111111-1111-1111-1111-111111111111',
      Duration: 120,
      Duration2: 125,
      importSource: 'editor',
    },
    {
      Id: 2,
      name: 'END OF SET',
      author: 'Fixture Band',
      content: '',
      key: 0,
      type: 1,
      Deleted: false,
      SyncId: '22222222-2222-2222-2222-222222222222',
    },
    {
      Id: 99,
      name: 'Not In Set',
      author: 'Other',
      content: '[A]Unused',
      type: 1,
      Deleted: false,
    },
  ],
  sets: [
    {
      details: {
        Id: 10,
        name: 'Tiny Set',
        date: '2026-05-28',
        Deleted: false,
        SyncId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        pinned: false,
      },
      contents: [
        { Id: 1, Order: 0, SetId: 10, SongId: 1, keyOfset: 2, ItemType: 1, Deleted: false },
        { Id: 2, Order: 1, SetId: 10, SongId: 2, keyOfset: 0, ItemType: 1, Deleted: false },
      ],
    },
  ],
  folders: [],
};

test('md5 empty string matches SBP empty chart hash', () => {
  assert.equal(md5(''), EMPTY_MD5);
  assert.equal(fingerprintContent(''), EMPTY_MD5);
  assert.equal(fingerprintContent(null), EMPTY_MD5);
});

test('md5 RFC vectors', () => {
  assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(md5('The quick brown fox jumps over the lazy dog'), '9e107d9d372bb6826bd81d3542a419d6');
});

test('chromatic key 0 is A', () => {
  assert.equal(sbpKeyToName(0), 'A');
  assert.equal(sbpKeyToName(11), 'G#');
  assert.equal(sbpKeyToName(19), 'key:19');
  assert.equal(keyNameToSbp('A'), 0);
  assert.equal(keyNameToSbp('Bb'), 1);
  assert.equal(keyNameToSbp('C'), 3);
});

test('pack and parse .sbp set share embeds only referenced songs', () => {
  const bytes = packSbpArchive(FIXTURE, { kind: 'set', setIds: [10] });
  const parsed = parseSbpArchive(bytes, 'set');
  assert.equal(parsed.version, '1.0');
  assert.equal(parsed.hashOk, true);
  assert.equal(parsed.library.songs.length, 2);
  assert.equal(parsed.library.songs.some((s) => s.Id === 99), false);
  assert.equal(parsed.library.songs.find((s) => s.Id === 2)?.content, '');
  assert.equal(parsed.library.songs.find((s) => s.Id === 2)?.hash, EMPTY_MD5);
  assert.equal(parsed.library.sets[0]?.contents?.[0]?.keyOfset, 2);
  assert.equal(parsed.settingsHive, undefined);
});

test('backup pack round-trips hive bytes and song extras', () => {
  const hive = new Uint8Array([0x44, 0x41, 0x52, 0x54, 0x01, 0x02]);
  const withExtra: SbpLibrary = {
    ...FIXTURE,
    songs: FIXTURE.songs.map((song) =>
      song.Id === 1 ? { ...song, mysteryField: 'keep-me', ZoomFactor: 1.2 } : song,
    ),
  };
  const bytes = packSbpArchive(withExtra, { kind: 'backup', settingsHive: hive });
  const parsed = parseSbpArchive(bytes, 'backup');
  assert.equal(parsed.hashOk, true);
  assert.ok(parsed.settingsHive);
  assert.equal(parsed.settingsHive![0], 0x44);
  assert.equal(parsed.library.songs.find((s) => s.Id === 1)?.mysteryField, 'keep-me');
  assert.equal(parsed.library.songs.length, 3);
});

test('chordpro parse inline chords, comments, and tab blocks', () => {
  const source = '{c: Intro}\n[G]Hello [C]world\n{sot}\ne|---2---|\n{eot}\n';
  const { document } = parseChordPro(source);
  assert.equal(document.sections[0]?.label, 'Intro');
  const paired = document.sections[0]?.lines[0];
  assert.equal(paired?.kind, 'paired');
  assert.equal(paired?.slots?.[0]?.chord, 'G');
  assert.equal(paired?.lyric?.includes('Hello'), true);
  const tab = document.sections.find((s) => s.kind === 'tab');
  assert.ok(tab);
  assert.equal(tab?.lines[0]?.lyric, 'e|---2---|');
  const exported = documentToChordPro(document);
  const again = parseChordPro(exported);
  assert.equal(again.document.sections[0]?.lines[0]?.slots?.[0]?.chord, 'G');
});

test('optional local SBP files: counts only when present (never committed)', () => {
  const backup =
    process.env.SBP_BACKUP_PATH ??
    'C:\\Users\\epicn\\Downloads\\SongbookPro Backup (1).sbpbackup';
  const setFile =
    process.env.SBP_SET_PATH ??
    'C:\\Users\\epicn\\Downloads\\Tyler Potter (5-28-2026).sbp';

  if (existsSync(backup)) {
    const parsed = parseSbpArchive(new Uint8Array(readFileSync(backup)), 'backup');
    assert.equal(parsed.hashOk, true);
    assert.equal(parsed.library.songs.length, 572);
    assert.equal(parsed.library.sets.length, 534);
  }

  if (existsSync(setFile)) {
    const parsed = parseSbpArchive(new Uint8Array(readFileSync(setFile)), 'set');
    assert.equal(parsed.hashOk, true);
    assert.equal(parsed.library.songs.length, 38);
    assert.equal(parsed.library.sets.length, 1);
    assert.ok(parsed.library.songs.some((s) => (s.content ?? '') === ''));
  }
});
