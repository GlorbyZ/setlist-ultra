export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value?.trim()) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const day = value.slice(0, 10);
    const fallback = new Date(`${day}T12:00:00`);
    if (Number.isNaN(fallback.getTime())) return value;
    return fallback.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSetMeta(eventDate: string | null | undefined, songCount: number, totalSeconds: number) {
  const date = formatDate(eventDate);
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
