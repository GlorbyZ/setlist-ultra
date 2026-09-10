/** Default full-chart autoscroll duration when a song has no duration set. */
export const DEFAULT_AUTOSCROLL_SECONDS = 90;

export function resolveAutoscrollSeconds(duration2?: number | null, durationSeconds?: number | null): number {
  const raw = duration2 ?? durationSeconds;
  if (raw != null && raw > 0) return raw;
  return DEFAULT_AUTOSCROLL_SECONDS;
}
