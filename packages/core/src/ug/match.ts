import type { UgTabResponse } from '../ast/types';
import { namesLikelyMatch, ugTabIdFromUrl } from '../html/entities';

export class UgVersionMismatchError extends Error {
  constructor(message = 'This chart did not match the version you tapped. Try another version.') {
    super(message);
    this.name = 'UgVersionMismatchError';
  }
}

/** Fail closed if the fetched chart is a different UG tab than the row the user tapped. */
export function assertUgTabMatchesRequest(
  response: UgTabResponse,
  requestedUrl: string,
  expected?: { songName?: string; artistName?: string },
): void {
  const requestedId = ugTabIdFromUrl(requestedUrl);
  const payloadUrl = response.tab.tab_url || response.requestedUrl || '';
  const payloadId = response.tab.id || (payloadUrl ? ugTabIdFromUrl(payloadUrl) : null);

  if (requestedId && payloadId && requestedId !== payloadId) {
    throw new UgVersionMismatchError();
  }

  if (expected?.songName && !namesLikelyMatch(response.tab.title, expected.songName)) {
    throw new UgVersionMismatchError();
  }
  if (expected?.artistName && !namesLikelyMatch(response.tab.artist_name, expected.artistName)) {
    throw new UgVersionMismatchError();
  }
}
