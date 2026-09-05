import { documentToChordPro, parseChordPro } from '@setlist-ultra/core';
import { insertLibrarySong, listSongs } from './repository';

const DEMO_CHORDPRO = `{title: Demo Song}
{artist: Setlist Ultra}
{key: G}
{c: Verse}
[G]Welcome to [C]Setlist Ultra
[D]Import a backup or [G]search online
`;

export async function seedDemoSongIfEmpty() {
  const existing = await listSongs({ libraryKind: 'personal' });
  if (existing.length > 0) return;

  const { document } = parseChordPro(DEMO_CHORDPRO);
  await insertLibrarySong({
    title: 'Demo Song',
    artist: 'Setlist Ultra',
    originalKey: 'G',
    chordpro: documentToChordPro(document, { title: 'Demo Song', artist: 'Setlist Ultra', key: 'G' }),
    document,
    importSource: 'editor',
    sourceProvider: 'manual',
    sourceUrl: 'demo://welcome',
    scope: { libraryKind: 'personal' },
  });
}
