import { decodeHtmlEntities } from '@setlist-ultra/core';

export type UgSearchHit = {
  title: string;
  url: string;
  songName?: string;
  artistName?: string;
  type?: string;
  /** UG js-store `rating` — star average when present (typically 0–5). */
  rating?: number;
  /** UG js-store `votes` or `hits` — popularity / vote count when present. */
  popularity?: number;
  key?: string;
  songId?: string;
};

export type UgSongGroup = {
  id: string;
  songName: string;
  artistName: string;
  versions: UgSearchHit[];
  rating?: number;
  popularity?: number;
};

function titleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function parseUgTabUrl(url: string): { songName?: string; artistName?: string } {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/tab\/([^/]+)\/([^/]+)/i);
    if (!match) return {};
    const artistName = titleCaseWords(decodeURIComponent(match[1]).replace(/-/g, ' '));
    const slug = decodeURIComponent(match[2]).replace(/-/g, ' ');
    const songName = titleCaseWords(
      slug.replace(/\b(chords|tabs|official|bass|drum|ukulele|solo|intro|video|pro)\b.*$/i, '').replace(/\s+\d+$/, ''),
    );
    return { artistName, songName };
  } catch {
    return {};
  }
}

function parseHitTitle(title: string) {
  const sep = title.includes(' — ') ? ' — ' : title.includes(' - ') ? ' - ' : title.includes(' by ') ? ' by ' : null;
  if (!sep) return { songName: title.trim(), artistName: '' };
  if (sep === ' by ') {
    const [songName, artistName] = title.split(/ by /i);
    return { songName: (songName ?? title).trim(), artistName: (artistName ?? '').trim() };
  }
  const [songName, artistName] = title.split(sep);
  return { songName: (songName ?? title).trim(), artistName: (artistName ?? '').trim() };
}

function typeRank(type?: string) {
  const value = (type ?? '').toLowerCase();
  if (value.includes('official')) return 9;
  if (value.includes('chord')) return 1;
  if (value === 'tab' || value.includes('tabs')) return 2;
  if (value.includes('pro') || value.includes('video')) return 5;
  return 3;
}

export function isOfficialUgType(type?: string) {
  return (type ?? '').toLowerCase().includes('official');
}

export function sortUgVersions(versions: UgSearchHit[]): UgSearchHit[] {
  return [...versions].sort((a, b) => {
    const rank = typeRank(a.type) - typeRank(b.type);
    if (rank) return rank;
    const rating = (b.rating ?? 0) - (a.rating ?? 0);
    if (rating) return rating;
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });
}

function groupScore(group: UgSongGroup) {
  const rating = Math.max(0, ...group.versions.map((row) => row.rating ?? 0));
  const popularity = Math.max(0, ...group.versions.map((row) => row.popularity ?? 0));
  return { rating, popularity };
}

/** Best rating, then popularity, then title / artist. Never uses songId. */
export function rankUgGroups(groups: UgSongGroup[]): UgSongGroup[] {
  return [...groups].sort((a, b) => {
    const sa = groupScore(a);
    const sb = groupScore(b);
    if (sb.rating !== sa.rating) return sb.rating - sa.rating;
    if (sb.popularity !== sa.popularity) return sb.popularity - sa.popularity;
    return a.songName.localeCompare(b.songName) || a.artistName.localeCompare(b.artistName);
  });
}

export function groupUgResults(hits: UgSearchHit[]): UgSongGroup[] {
  const map = new Map<string, UgSongGroup>();
  for (const hit of hits) {
    if (isOfficialUgType(hit.type)) continue;
    const parsed = parseHitTitle(decodeHtmlEntities(hit.title));
    const fromUrl = parseUgTabUrl(hit.url);
    const songName = decodeHtmlEntities(
      hit.songName?.trim() || parsed.songName || fromUrl.songName || 'Untitled',
    );
    const artistName = decodeHtmlEntities(
      hit.artistName?.trim() || parsed.artistName || fromUrl.artistName || '',
    );
    const id = `${songName}:::${artistName}`.toLowerCase();
    const existing = map.get(id);
    const version: UgSearchHit = {
      ...hit,
      title: decodeHtmlEntities(hit.title),
      songName,
      artistName,
    };
    if (existing) {
      if (!existing.versions.some((row) => row.url === hit.url)) existing.versions.push(version);
    } else {
      map.set(id, { id, songName, artistName, versions: [version] });
    }
  }
  return rankUgGroups(
    [...map.values()].map((group) => {
      const versions = sortUgVersions(group.versions);
      const { rating, popularity } = groupScore({ ...group, versions });
      return {
        ...group,
        versions,
        rating: rating || undefined,
        popularity: popularity || undefined,
      };
    }),
  );
}

export function mergeUgHits(existing: UgSearchHit[], incoming: UgSearchHit[]): UgSearchHit[] {
  const out = [...existing];
  for (const hit of incoming) {
    if (!out.some((row) => row.url === hit.url)) out.push(hit);
  }
  return out;
}
