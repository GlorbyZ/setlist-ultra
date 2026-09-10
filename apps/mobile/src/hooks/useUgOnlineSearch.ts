import { useCallback, useEffect, useRef, useState } from 'react';

import {
  appendUgGroups,
  groupUgResults,
  mergeUgHits,
  searchUgTabs,
  UG_PAGE_SIZE,
  type UgSearchHit,
  type UgSongGroup,
} from '@/src/lib/ug-api';

export type UgOnlineStatus = 'idle' | 'searching' | 'ready' | 'empty' | 'error';

export type UseUgOnlineSearchOptions = {
  /** Debounce for auto-fetch when query changes. Default 400. */
  debounceMs?: number;
  /**
   * When false, auto-search is skipped.
   * Use for Songs local-first gating (enough local hits and user has not asked for online).
   */
  enabled?: boolean;
  /**
   * When enabled flips to false, clear online results.
   * Default true so Songs local-first does not leave stale Online rows.
   */
  clearWhenDisabled?: boolean;
};

export type UgOnlineSearchApi = {
  groups: UgSongGroup[];
  hits: UgSearchHit[];
  status: UgOnlineStatus;
  error: string | null;
  nextPage: number | null;
  loadingMore: boolean;
  /** Fetch page 1 for the current (or override) query. */
  runSearch: (overrideQuery?: string) => void;
  /** Fetch nextPage if available. */
  loadMore: () => void;
  reset: () => void;
};

/**
 * Shared Ultimate Guitar online search used by Songs tab and Add songs.
 * Handles debounce, race cancellation, merge/group ranking, and load-more.
 */
export function useUgOnlineSearch(query: string, opts?: UseUgOnlineSearchOptions): UgOnlineSearchApi {
  const debounceMs = opts?.debounceMs ?? 400;
  const enabled = opts?.enabled ?? true;
  const clearWhenDisabled = opts?.clearWhenDisabled ?? true;

  const [hits, setHits] = useState<UgSearchHit[]>([]);
  const [groups, setGroups] = useState<UgSongGroup[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [status, setStatus] = useState<UgOnlineStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const genRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  const reset = useCallback(() => {
    genRef.current += 1;
    setHits([]);
    setGroups([]);
    setNextPage(null);
    setStatus('idle');
    setError(null);
    setLoadingMore(false);
  }, []);

  const fetchPage = useCallback(async (raw: string, page: number, append: boolean) => {
    const term = raw.trim();
    if (!term) return;
    const gen = ++genRef.current;
    if (page === 1) {
      setStatus('searching');
      setError(null);
      if (!append) setHits([]);
    } else {
      setLoadingMore(true);
    }
    try {
      const result = await searchUgTabs(term, { page, pageSize: UG_PAGE_SIZE });
      if (gen !== genRef.current) return;
      setHits((prev) => (page === 1 && !append ? result.hits : mergeUgHits(prev, result.hits)));
      setGroups((prev) =>
        page === 1 && !append ? groupUgResults(result.hits) : appendUgGroups(prev, result.hits),
      );
      setNextPage(result.nextPage);
      setStatus(result.groups.length || result.hits.length ? 'ready' : 'empty');
    } catch (err) {
      if (gen !== genRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      if (gen === genRef.current) setLoadingMore(false);
    }
  }, []);

  const runSearch = useCallback(
    (overrideQuery?: string) => {
      const term = (overrideQuery ?? queryRef.current).trim();
      if (!term) {
        reset();
        return;
      }
      void fetchPage(term, 1, false);
    },
    [fetchPage, reset],
  );

  const loadMore = useCallback(() => {
    const term = queryRef.current.trim();
    if (!term || nextPage == null || loadingMore || status === 'searching') return;
    void fetchPage(term, nextPage, true);
  }, [fetchPage, nextPage, loadingMore, status]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      reset();
      return;
    }
    if (!enabled) {
      if (clearWhenDisabled) {
        genRef.current += 1;
        setHits([]);
        setGroups([]);
        setNextPage(null);
        setStatus('idle');
        setError(null);
        setLoadingMore(false);
      }
      return;
    }
    const handle = setTimeout(() => void fetchPage(term, 1, false), debounceMs);
    return () => clearTimeout(handle);
  }, [query, enabled, clearWhenDisabled, debounceMs, fetchPage, reset]);

  return {
    groups,
    hits,
    status,
    error,
    nextPage,
    loadingMore,
    runSearch,
    loadMore,
    reset,
  };
}
