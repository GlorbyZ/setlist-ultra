export type SearchableSong = {
  id: string;
  title: string;
  artist: string;
  tags?: string | null;
  notesText?: string | null;
  originalKey?: string | null;
  durationSeconds?: number | null;
  importSource?: string | null;
};

const STOP = new Set([
  'a', 'an', 'and', 'the', 'from', 'with', 'this', 'that', 'your', 'my', 'our',
  'build', 'set', 'setlist', 'song', 'songs', 'chart', 'charts', 'please', 'make',
  'fix', 'clean', 'import', 'library', 'minutes', 'minute', 'hour', 'help',
]);

export function tagsOf(song: SearchableSong): string[] {
  return (song.tags ?? '')
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function isFavoriteSong(song: SearchableSong): boolean {
  return tagsOf(song).some((tag) => tag.toLowerCase() === 'favorite');
}

export type LibrarySearchHit = SearchableSong & { score: number };

export function searchLibrary(
  songs: SearchableSong[],
  query: string,
  options?: { favoritesOnly?: boolean; limit?: number },
): LibrarySearchHit[] {
  const favoritesOnly = options?.favoritesOnly ?? /\bfavou?rites?\b/i.test(query);
  const limit = options?.limit ?? 40;
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9#]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP.has(token));

  let pool = songs;
  if (favoritesOnly) pool = pool.filter(isFavoriteSong);

  if (!tokens.length) {
    return pool.slice(0, limit).map((song) => ({ ...song, score: 1 }));
  }

  const ranked: LibrarySearchHit[] = [];
  for (const song of pool) {
    const blob = `${song.title} ${song.artist} ${song.tags ?? ''} ${song.notesText ?? ''} ${song.importSource ?? ''} ${song.originalKey ?? ''}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (song.title.toLowerCase().includes(token)) score += 4;
      else if (song.artist.toLowerCase().includes(token)) score += 3;
      else if (blob.includes(token)) score += 1;
    }
    if (score > 0) ranked.push({ ...song, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  if (!ranked.length) {
    return pool.slice(0, limit).map((song) => ({ ...song, score: 1 }));
  }
  return ranked.slice(0, limit);
}

export function estimateSetDuration(songs: SearchableSong[]): {
  knownSeconds: number;
  missingIds: string[];
} {
  let knownSeconds = 0;
  const missingIds: string[] = [];
  for (const song of songs) {
    const duration = song.durationSeconds;
    if (duration && duration > 0) knownSeconds += duration;
    else missingIds.push(song.id);
  }
  return { knownSeconds, missingIds };
}
