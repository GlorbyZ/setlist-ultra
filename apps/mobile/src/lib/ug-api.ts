import type { UgTabResponse } from '@setlist-ultra/core';
import { config } from './config';

export type UgSearchHit = {
  title: string;
  url: string;
  songName?: string;
  artistName?: string;
  type?: string;
  rating?: number;
  key?: string;
  songId?: string;
};

export type UgSearchResult = UgSearchHit;

export type UgSongGroup = {
  id: string;
  songName: string;
  artistName: string;
  versions: UgSearchHit[];
};

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

export function groupUgResults(hits: UgSearchHit[]): UgSongGroup[] {
  const map = new Map<string, UgSongGroup>();
  for (const hit of hits) {
    const parsed = parseHitTitle(hit.title);
    const songName = hit.songName?.trim() || parsed.songName;
    const artistName = hit.artistName?.trim() || parsed.artistName;
    const id = (hit.songId || `${songName}:::${artistName}`).toLowerCase();
    const existing = map.get(id);
    const version: UgSearchHit = { ...hit, songName, artistName };
    if (existing) {
      if (!existing.versions.some((row) => row.url === hit.url)) existing.versions.push(version);
    } else {
      map.set(id, { id, songName, artistName, versions: [version] });
    }
  }
  return [...map.values()];
}

export async function searchUgTabs(query: string): Promise<UgSearchHit[]> {
  const base = config.ugProxyUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }

  const data = (await response.json()) as { results: UgSearchHit[] };
  return data.results ?? [];
}

export async function importUgTab(url: string): Promise<UgTabResponse> {
  const base = config.ugProxyUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/tab?url=${encodeURIComponent(url)}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Import failed (${response.status})`);
  }

  return (await response.json()) as UgTabResponse;
}
