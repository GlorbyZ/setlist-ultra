export type SetlistCloneItem = {
  itemType: string;
  songId?: string | null;
  noteContent?: string | null;
  timerSeconds?: number | null;
};

/** Same title + same ordered items → exact clone. Different arrangements stay. */
export function setlistCloneSignature(title: string, items: SetlistCloneItem[]): string {
  const head = title.trim().toLowerCase();
  const body = items
    .map((item) =>
      [item.itemType, item.songId ?? '', item.noteContent ?? '', item.timerSeconds ?? ''].join('\t'),
    )
    .join('\n');
  return `${head}\n${body}`;
}
