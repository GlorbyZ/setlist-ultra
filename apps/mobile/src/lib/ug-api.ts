import type { UgTabResponse } from '@setlist-ultra/core';
import { config } from './config';
import { groupUgResults, type UgSearchHit } from './ug-group';

export type { UgSearchHit, UgSongGroup } from './ug-group';
export { groupUgResults, parseUgTabUrl, sortUgVersions } from './ug-group';

export type UgSearchResult = UgSearchHit;

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
