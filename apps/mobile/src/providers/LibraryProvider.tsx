import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SongRow, SetlistRow } from '@setlist-ultra/db';
import { listSetlists, listSongs } from '@/src/lib/repository';
import { seedDemoSongIfEmpty } from '@/src/lib/seed';

type LibraryContextValue = {
  songs: SongRow[];
  setlists: SetlistRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [setlists, setSetlists] = useState<SetlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDemoSongIfEmpty();
      const [songRows, setlistRows] = await Promise.all([listSongs(), listSetlists()]);
      setSongs(songRows);
      setSetlists(setlistRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load library';
      console.error('Library init failed:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({ songs, setlists, loading, error, refresh }),
    [songs, setlists, loading, error],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
