import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectImportFormat, looksLikeChordPro } from './detect';
import { archiveSourceKey, hashImportBytes } from './identity';
import { assertImportPayload, inspectUnzippedArchive } from './inspect';

test('detects SBP zip magic and ChordPro text', () => {
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
  assert.equal(detectImportFormat(zip, 'gig.sbp'), 'sbp');
  assert.equal(detectImportFormat(zip, 'lib.sbpbackup'), 'sbpbackup');
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  assert.equal(detectImportFormat(pdf, 'chart.pdf'), 'pdf');
  const cho = new TextEncoder().encode('{title: Hello}\n[G]Hi');
  assert.equal(detectImportFormat(cho, 'hello.cho'), 'chordpro');
  const onsong = new TextEncoder().encode('Title: Hello\nArtist: Band\n[G]Hi');
  assert.equal(detectImportFormat(onsong, 'hello.onsong'), 'onsong');
  assert.equal(looksLikeChordPro('{title: X}'), true);
});

test('archive source keys do not collide across files', () => {
  const a = archiveSourceKey('hash-a', 'song', 1);
  const b = archiveSourceKey('hash-b', 'song', 1);
  assert.notEqual(a, b);
  assert.equal(a, 'sbp:hash-a:song:1');
});

test('inspect rejects path traversal and oversized entry counts', () => {
  assert.throws(() => inspectUnzippedArchive({ '../secret.txt': new Uint8Array([1]) }, 10));
  const many: Record<string, Uint8Array> = {};
  for (let i = 0; i < 4001; i += 1) many[`f${i}`] = new Uint8Array([1]);
  assert.throws(() => inspectUnzippedArchive(many, 4001));
  const bomb = { 'a.bin': new Uint8Array(170_000) };
  assert.throws(() => inspectUnzippedArchive(bomb, 2049));
});

test('assertImportPayload rejects empty and oversized files', () => {
  assert.throws(() => assertImportPayload(new Uint8Array()));
  assert.throws(() => assertImportPayload(undefined));
  const huge = { byteLength: 80 * 1024 * 1024 + 1 } as Uint8Array;
  assert.throws(() => assertImportPayload(huge));
  assert.doesNotThrow(() => assertImportPayload(new Uint8Array([1, 2, 3])));
});

test('byte hash includes length so truncated copies differ', () => {
  const left = hashImportBytes(new Uint8Array([1, 2, 3]));
  const right = hashImportBytes(new Uint8Array([1, 2, 3, 4]));
  assert.notEqual(left, right);
});
