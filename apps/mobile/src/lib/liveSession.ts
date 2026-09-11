const scrollBySong = new Map<string, number>();

export function rememberLiveScroll(songId: string, y: number) {
  if (!songId || !Number.isFinite(y) || y < 0) return;
  scrollBySong.set(songId, y);
}

export function liveScrollFor(songId: string) {
  return scrollBySong.get(songId) ?? 0;
}

/** Follow a band set from local DB without replacing the chart currently on stage. */
export function mergeFollowQueue<T extends { id: string }>(
  current: T | null,
  incoming: T[],
): { queue: T[]; index: number } {
  if (!current) return { queue: incoming, index: 0 };
  const idx = incoming.findIndex((row) => row.id === current.id);
  if (idx < 0) return { queue: [current, ...incoming.filter((row) => row.id !== current.id)], index: 0 };
  return {
    queue: incoming.map((row, i) => (i === idx ? current : row)),
    index: idx,
  };
}
