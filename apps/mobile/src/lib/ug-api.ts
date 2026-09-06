import type { UgTabResponse } from '@setlist-ultra/core';
import { config } from './config';
import { groupUgResults, type UgSearchHit, type UgSongGroup } from './ug-group';

export type { UgSearchHit, UgSongGroup } from './ug-group';
export { groupUgResults, mergeUgHits, parseUgTabUrl, rankUgGroups, sortUgVersions } from './ug-group';

export type UgSearchResult = UgSearchHit;

export type UgSearchPage = {
  hits: UgSearchHit[];
  groups: UgSongGroup[];
  page: number;
  pageSize: number;
  nextPage: number | null;
};

export const UG_PAGE_SIZE = 20;

export async function searchUgTabs(
  query: string,
  opts?: { page?: number; pageSize?: number },
): Promise<UgSearchPage> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(40, Math.max(5, opts?.pageSize ?? UG_PAGE_SIZE));
  const base = config.ugProxyUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: String(pageSize),
    sort: 'rating,popularity',
  });
  const response = await fetch(`${base}/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    results?: UgSearchHit[];
    songs?: UgSongGroup[];
    page?: number;
    pageSize?: number;
    nextPage?: number | null;
  };
  const hits = data.results ?? [];
  // Always regroup from hits so Level A is title+artist (never proxy songId blobs / sliced pages).
  const groups = groupUgResults(hits);
  return {
    hits,
    groups,
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    nextPage: data.nextPage ?? null,
  };
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
