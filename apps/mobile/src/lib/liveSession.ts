const scrollBySong = new Map<string, number>();

export function rememberLiveScroll(songId: string, y: number) {
  if (!songId || !Number.isFinite(y) || y < 0) return;
  scrollBySong.set(songId, y);
}

export function liveScrollFor(songId: string) {
  return scrollBySong.get(songId) ?? 0;
}
