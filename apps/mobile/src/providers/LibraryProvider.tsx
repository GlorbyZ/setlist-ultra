import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OrgRow, SetlistRow, SongRow } from '@setlist-ultra/db';
import {
  getAppState,
  getLibraryScope,
  listOrgs,
  listSetlists,
  listSongs,
  patchAppState,
  type LibraryScope,
} from '@/src/lib/repository';
import { seedDemoSongIfEmpty } from '@/src/lib/seed';

type LibraryContextValue = {
  songs: SongRow[];
  setlists: SetlistRow[];
  orgs: OrgRow[];
  scope: LibraryScope;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setScope: (scope: LibraryScope) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [setlists, setSetlists] = useState<SetlistRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [scope, setScopeState] = useState<LibraryScope>({ libraryKind: 'personal' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      await seedDemoSongIfEmpty();
      const current = await getLibraryScope();
      setScopeState(current);
      const [songRows, setlistRows, orgRows] = await Promise.all([
        listSongs(current),
        listSetlists(current),
        listOrgs(),
      ]);
      setSongs(songRows);
      setSetlists(setlistRows);
      setOrgs(orgRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load library';
      console.error('Library init failed:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const setScope = useCallback(async (next: LibraryScope) => {
    await patchAppState({
      currentLibraryKind: next.libraryKind,
      currentOrgId: next.orgId ?? null,
    });
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({ songs, setlists, orgs, scope, loading, error, refresh, setScope }),
    [songs, setlists, orgs, scope, loading, error, refresh, setScope],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}

export async function rememberLive(songId?: string | null, setlistId?: string | null, index = 0) {
  await patchAppState({
    currentSongId: songId ?? null,
    currentSetlistId: setlistId ?? null,
    currentSetIndex: index,
  });
  return getAppState();
}
