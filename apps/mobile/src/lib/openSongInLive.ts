import { type Href, router } from 'expo-router';

import { rememberLive } from '@/src/providers/LibraryProvider';

type LiveRouter = Pick<typeof router, 'navigate' | 'replace'>;

/** Leave any active set, then open the Live tab on this song. */
export async function openSongInLive(nav: LiveRouter, songId: string, mode: 'navigate' | 'replace' = 'navigate') {
  await rememberLive(songId, null, 0);
  if (mode === 'replace') nav.replace('/live' as Href);
  else nav.navigate('/live' as Href);
}
