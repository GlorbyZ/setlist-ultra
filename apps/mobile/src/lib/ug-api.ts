import type { UgTabResponse } from '@setlist-ultra/core';
import { config } from './config';
import { groupUgResults, type UgSearchHit, type UgSongGroup } from './ug-group';

export type { UgSearchHit, UgSongGroup } from './ug-group';
export { groupUgResults, mergeUgHits, parseUgTabUrl, rankUgGroups, sortUgVersions, isOfficialUgType } from './ug-group';

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
  const body = await response.text();
  let data: UgTabResponse & { error?: string };
  try {
    data = JSON.parse(body) as UgTabResponse & { error?: string };
  } catch {
    throw new Error(humanUgError(body, response.status));
  }
  if (!response.ok || data.error) {
    throw new Error(humanUgError(body, response.status));
  }
  return data;
}

function humanUgError(body: string, status?: number) {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (typeof parsed.error === 'string') {
      if (/could not read chart/i.test(parsed.error)) {
        return 'This version cannot be opened. Try another arrangement.';
      }
      return parsed.error;
    }
  } catch {
    /* use fallback */
  }
  if (body.trim().startsWith('{')) return 'Could not open this version.';
  return body || `Import failed (${status ?? '?'})`;
}
