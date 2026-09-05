import { Platform } from 'react-native';

import { config } from './config';
import { buildSbpLibrary, listSetlists, listSongs } from './repository';

export type ManagerSnapshot = {
  updatedAt: string;
  songs: { id: string; title: string; artist: string }[];
  setlists: { id: string; title: string; eventDate: string | null }[];
};

export async function localManagerSnapshot(): Promise<ManagerSnapshot> {
  const [songs, setlists] = await Promise.all([listSongs(), listSetlists()]);
  return {
    updatedAt: new Date().toISOString(),
    songs: songs.map((s) => ({ id: s.id, title: s.title, artist: s.artist })),
    setlists: setlists.map((s) => ({ id: s.id, title: s.title, eventDate: s.eventDate })),
  };
}

export async function pushSnapshotToManager(baseUrl = config.managerUrl) {
  const snapshot = await localManagerSnapshot();
  const library = await buildSbpLibrary();
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot, library }),
  });
  if (!response.ok) {
    throw new Error(`Manager push failed (${response.status})`);
  }
  return snapshot;
}

export function managerClientHint(): string {
  if (Platform.OS === 'web') {
    return 'This browser is the Manager client. Sign in for Groups, or run npm run manager on a PC to receive a phone snapshot.';
  }
  return 'Start npm run manager on your PC (port 3848), then push this library. Laptops browse that URL — the phone does not need to host HTTP.';
}
