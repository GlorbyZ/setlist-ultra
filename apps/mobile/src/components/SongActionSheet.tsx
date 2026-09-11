import type { SongRow } from '@setlist-ultra/db';

import { ActionSheet } from '@/src/components/BrandDialog';
import { songDisplayName } from '@/src/lib/ai/present';
import { launchFlags } from '@/src/lib/launchFlags';

type Props = {
  song: SongRow | null;
  favorite?: boolean;
  onClose: () => void;
  onOpenLive: (song: SongRow) => void;
  onAddToSet: (song: SongRow) => void;
  onSongSettings: (song: SongRow) => void;
  onCleanUp?: (song: SongRow) => void;
  onToggleFavorite: (song: SongRow) => void;
  onDelete: (song: SongRow) => void;
};

export function SongActionSheet({
  song,
  favorite,
  onClose,
  onOpenLive,
  onAddToSet,
  onSongSettings,
  onCleanUp,
  onToggleFavorite,
  onDelete,
}: Props) {
  if (!song) return null;
  return (
    <ActionSheet
      visible
      title={songDisplayName(song)}
      onClose={onClose}
      options={[
        { label: 'Open in Live', onPress: () => onOpenLive(song) },
        { label: 'Add to set', onPress: () => onAddToSet(song) },
        { label: 'Song Settings', onPress: () => onSongSettings(song) },
        ...(launchFlags.ai && onCleanUp ? [{ label: 'Clean Up Chart', onPress: () => onCleanUp(song) }] : []),
        { label: favorite ? 'Unfavorite' : 'Favorite', onPress: () => onToggleFavorite(song) },
        { label: 'Delete', danger: true, onPress: () => onDelete(song) },
      ]}
    />
  );
}
