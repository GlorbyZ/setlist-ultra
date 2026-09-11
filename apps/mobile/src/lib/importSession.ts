import { pickBinaryFile } from './files';
import { noteAppError } from './bugReport';
import {
  importAnyChartFile,
  undoImportJob,
  type ImportProgressEvent,
} from './repository';

export type ImportSessionState = {
  running: boolean;
  progress: ImportProgressEvent | null;
  error: string | null;
  finished: boolean;
  jobId: string | null;
  songId: string | null;
  closeOnDone: boolean;
};

const emptyProgress = (title?: string): ImportProgressEvent => ({
  phase: 'songs',
  totalSongs: 0,
  processedSongs: 0,
  created: 0,
  reused: 0,
  variants: 0,
  skipped: 0,
  failed: 0,
  currentTitle: title,
  status: 'running',
});

let state: ImportSessionState = {
  running: false,
  progress: null,
  error: null,
  finished: false,
  jobId: null,
  songId: null,
  closeOnDone: false,
};

const listeners = new Set<() => void>();
let abort: AbortController | null = null;
let libraryRefresher: (() => Promise<void>) | null = null;
let generation = 0;

function emit(patch: Partial<ImportSessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getImportSession() {
  return state;
}

export function subscribeImportSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isImportSessionRunning() {
  return state.running;
}

export function setImportSessionLibraryRefresher(fn: (() => Promise<void>) | null) {
  libraryRefresher = fn;
}

export function cancelImportSession() {
  generation += 1;
  abort?.abort();
  if (!state.finished && !state.error) {
    emit({
      running: false,
      progress: null,
      error: null,
      finished: false,
    });
  }
}

export function dismissImportSession() {
  generation += 1;
  emit({
    running: false,
    progress: null,
    error: null,
    finished: false,
    jobId: null,
    songId: null,
    closeOnDone: false,
  });
}

export async function undoSessionImport() {
  const id = state.jobId;
  if (!id) return;
  await undoImportJob(id);
  await libraryRefresher?.();
  dismissImportSession();
}

export async function runChartImport(bytes: Uint8Array, name?: string) {
  abort = new AbortController();
  emit({
    running: true,
    error: null,
    finished: false,
    jobId: null,
    songId: null,
    progress: emptyProgress(name || 'Reading file'),
  });
  try {
    const result = await importAnyChartFile(bytes, name, {
      signal: abort.signal,
      onProgress: (event) => {
        emit({
          progress: event,
          jobId: event.jobId ?? state.jobId,
        });
      },
    });
    await libraryRefresher?.();
    if (result.kind === 'song' && result.songId) {
      emit({
        running: false,
        progress: null,
        finished: false,
        songId: result.songId,
      });
      return;
    }
    emit({ running: false, finished: true, songId: null });
  } catch (error) {
    const cancelled = error instanceof Error && error.name === 'AbortError';
    if (cancelled) {
      emit({
        running: false,
        progress: null,
        error: null,
        finished: false,
      });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    noteAppError(`import: ${message}`);
    emit({ running: false, error: message, finished: false });
  } finally {
    abort = null;
  }
}

export async function beginFilePickImport() {
  if (state.running) return;
  const token = ++generation;
  emit({
    running: true,
    error: null,
    finished: false,
    jobId: null,
    songId: null,
    closeOnDone: true,
    progress: emptyProgress('Choose a file'),
  });
  try {
    const picked = await pickBinaryFile();
    if (token !== generation) return;
    if (!picked) {
      emit({ running: false, progress: null });
      return;
    }
    await runChartImport(picked.bytes, picked.name);
  } catch (error) {
    if (token !== generation) return;
    const message = error instanceof Error ? error.message : 'Could not read that file.';
    noteAppError(`file pick: ${message}`);
    emit({
      running: false,
      progress: emptyProgress(),
      error: message,
      finished: false,
    });
  }
}
