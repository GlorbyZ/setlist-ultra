import {
  CAPO_OPTIONS,
  KEY_OPTIONS,
  keyShiftForTargetKey,
  soundingKeyName,
} from '@setlist-ultra/core';

import { formatClock } from '@/src/lib/format';
import { resolveAutoscrollSeconds } from '@/src/lib/autoscroll';
import { updateSong } from '@/src/lib/repository';

export { CAPO_OPTIONS, KEY_OPTIONS };

export function wrapCapo(value: number, delta: number) {
  const next = value + delta;
  if (next < 0) return 12;
  if (next > 12) return 0;
  return next;
}

export function wrapKeyShift(value: number, delta: number) {
  // Keep unbounded-ish but normalize display via sounding key; store wrapped-ish for stability
  return value + delta;
}

export function songMetaLine(
  song: {
    artist: string;
    originalKey: string | null;
    keyShift?: number | null;
    duration2?: number | null;
    durationSeconds?: number | null;
  },
  keyShift: number,
) {
  const duration = resolveAutoscrollSeconds(song.duration2, song.durationSeconds);
  const sounding = soundingKeyName(song.originalKey, keyShift) ?? song.originalKey;
  return [song.artist, sounding, formatClock(duration)].filter(Boolean).join(' · ');
}

/** Persist Live Key/Capo to song storage (SBP: keyShift + capo; originalKey stays written). */
export async function persistLiveKeyCapo(
  songId: string,
  patch: { keyShift?: number; capo?: number },
) {
  await updateSong(songId, patch);
}

export function keyShiftToPick(originalKey: string | null | undefined, targetKey: string, current: number) {
  return keyShiftForTargetKey(originalKey, targetKey, current);
}

export function currentSoundingKey(originalKey: string | null | undefined, keyShift: number) {
  return soundingKeyName(originalKey, keyShift) ?? originalKey ?? 'A';
}
