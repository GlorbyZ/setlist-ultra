import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SongRow, SetlistRow } from '@setlist-ultra/db';
import { listSetlists, listSongs } from '@/src/lib/repository';
import { seedDemoSongIfEmpty } from '@/src/lib/seed';

type LibraryContextValue = {
  songs: SongRow[];
  setlists: SetlistRow[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [setlists, setSetlists] = useState<SetlistRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      await seedDemoSongIfEmpty();
      const [songRows, setlistRows] = await Promise.all([listSongs(), listSetlists()]);
      setSongs(songRows);
      setSetlists(setlistRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({ songs, setlists, loading, refresh }),
    [songs, setlists, loading],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
