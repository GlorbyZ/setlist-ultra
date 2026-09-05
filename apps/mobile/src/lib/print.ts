import { Platform } from 'react-native';

import { documentToChordPro, parseChordPro } from '@setlist-ultra/core';
import type { SongRow } from '@setlist-ultra/db';

function songHtml(song: SongRow): string {
  const chordpro = song.chordpro || documentToChordPro(parseChordPro(song.chordpro || '').document);
  const escaped = chordpro
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${song.title}</title>
<style>
  body { font-family: ui-monospace, monospace; padding: 24px; color: #111; }
  h1 { font-family: system-ui, sans-serif; }
  pre { white-space: pre-wrap; font-size: 16px; line-height: 1.45; }
</style></head><body>
<h1>${song.title}</h1>
<p>${song.artist}${song.originalKey ? ` · ${song.originalKey}` : ''}</p>
<pre>${escaped}</pre>
</body></html>`;
}

export async function printSong(song: SongRow) {
  const html = songHtml(song);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
    return;
  }
  const Print = await import('expo-print');
  await Print.printAsync({ html });
}
