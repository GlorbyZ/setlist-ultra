import { useRouter } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { ImportOverlay } from '@/src/components/ImportOverlay';
import {
  cancelImportSession,
  dismissImportSession,
  getImportSession,
  setImportSessionLibraryRefresher,
  subscribeImportSession,
  undoSessionImport,
} from '@/src/lib/importSession';
import { openSongInLive } from '@/src/lib/openSongInLive';
import { useLibrary } from '@/src/providers/LibraryProvider';

export function ImportSessionHost() {
  const router = useRouter();
  const { refresh } = useLibrary();
  const session = useSyncExternalStore(subscribeImportSession, getImportSession, getImportSession);

  useEffect(() => {
    setImportSessionLibraryRefresher(refresh);
    return () => setImportSessionLibraryRefresher(null);
  }, [refresh]);

  useEffect(() => {
    if (!session.songId || session.running || session.progress) return;
    const id = session.songId;
    dismissImportSession();
    void openSongInLive(router, id, 'replace');
  }, [session.songId, session.running, session.progress, router]);

  return (
    <ImportOverlay
      visible={Boolean(session.progress) || Boolean(session.error)}
      progress={session.progress}
      error={session.error}
      finished={session.finished}
      onCancel={cancelImportSession}
      onDone={() => {
        const closeImport = session.closeOnDone && !session.error;
        dismissImportSession();
        if (closeImport) router.back();
      }}
      onUndo={session.jobId ? () => void undoSessionImport() : undefined}
    />
  );
}
