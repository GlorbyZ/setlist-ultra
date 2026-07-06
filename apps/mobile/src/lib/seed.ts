import type { UgTabResponse } from '@setlist-ultra/core';
import { getDatabase } from './db';
import { listSongs, saveSongFromUg } from './repository';
import { songs } from '@setlist-ultra/db';

const DEMO_TAB: UgTabResponse = {
  tab: {
    title: 'Demo Song',
    artist_name: 'Setlist Ultra',
    key: 'G',
    capo: '0',
    lines: [
      { type: 'chords', chords: [{ note: 'G', pre_spaces: 0 }, { note: 'C', pre_spaces: 8 }] },
      { type: 'lyric', lyric: 'Welcome to Setlist Ultra' },
      { type: 'blank' },
      { type: 'chords', chords: [{ note: 'D', pre_spaces: 0 }, { note: 'G', pre_spaces: 10 }] },
      { type: 'lyric', lyric: 'Import tabs from Ultimate Guitar to get started' },
    ],
  },
};

export async function seedDemoSongIfEmpty() {
  const existing = await listSongs();
  if (existing.length > 0) return;

  await saveSongFromUg(DEMO_TAB, 'demo://welcome');
}

export async function resetDatabase() {
  const db = await getDatabase();
  await db.delete(songs);
}
