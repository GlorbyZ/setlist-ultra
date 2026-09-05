export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatSetMeta(eventDate: string | null | undefined, songCount: number, totalSeconds: number) {
  const date = eventDate?.trim() || 'No date';
  const songs = `${songCount} song${songCount === 1 ? '' : 's'}`;
  return `${date} · ${songs} · ${formatClock(totalSeconds)}`;
}

export function filenameFromUri(uri: string) {
  try {
    const cleaned = decodeURIComponent(uri.split('?')[0] ?? uri);
    const last = cleaned.split('/').pop() ?? 'import.sbp';
    return last || 'import.sbp';
  } catch {
    return 'import.sbp';
  }
}
