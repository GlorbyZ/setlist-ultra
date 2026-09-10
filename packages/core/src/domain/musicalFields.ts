/** Duration and key fields are independent. Do not infer a missing stored value from another. */

export type MusicalFields = {
  /** Original/written key on the chart. */
  writtenKey?: string | null;
  /** Concert transposition in semitones (stored as keyShift). */
  concertShift?: number | null;
  /** Fingering capo; does not change concert pitch by itself. */
  capo?: number | null;
  /** Performance / set-timing length. */
  performanceSeconds?: number | null;
  /** Autoscroll length when the user set one. */
  autoscrollSeconds?: number | null;
};

export function storedWrittenKey(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function storedConcertShift(value?: number | null): number {
  return value ?? 0;
}

export function storedCapo(value?: number | null): number {
  return value ?? 0;
}

/** Stored performance length only. Null means unset — do not invent a duration. */
export function storedPerformanceSeconds(value?: number | null): number | null {
  if (value == null || value <= 0) return null;
  return value;
}

/** Stored autoscroll length only. Null means unset — do not copy performance length. */
export function storedAutoscrollSeconds(value?: number | null): number | null {
  if (value == null || value <= 0) return null;
  return value;
}
