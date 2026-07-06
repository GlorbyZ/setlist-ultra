import type { UgTabResponse } from '@setlist-ultra/core';
import { config } from './config';

export type UgSearchResult = {
  title: string;
  url: string;
};

export async function searchUgTabs(query: string): Promise<UgSearchResult[]> {
  const base = config.ugProxyUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }

  const data = (await response.json()) as { results: UgSearchResult[] };
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
