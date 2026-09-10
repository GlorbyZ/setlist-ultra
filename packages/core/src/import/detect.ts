export type ImportFormat = 'sbp' | 'sbpbackup' | 'chordpro' | 'onsong' | 'pdf' | 'unknown';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b];

function startsWith(bytes: Uint8Array, magic: number[]) {
  return magic.every((value, index) => bytes[index] === value);
}

function headText(bytes: Uint8Array, max = 800) {
  const slice = bytes.subarray(0, Math.min(bytes.byteLength, max));
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(slice);
  } catch {
    return '';
  }
}

export function looksLikeChordPro(text: string) {
  const sample = text.slice(0, 2000);
  if (/\{(?:title|t|artist|subtitle|key|capo)\s*:/i.test(sample)) return true;
  if (/\[[A-G][#b]?(?:m|maj|min|sus|dim|aug|add)?\d*\]/.test(sample)) return true;
  return false;
}

export function detectImportFormat(bytes: Uint8Array, filename?: string): ImportFormat {
  const name = (filename ?? '').toLowerCase();
  if (name.endsWith('.pdf') || startsWith(bytes, PDF_MAGIC)) return 'pdf';
  if (name.endsWith('.sbpbackup')) return 'sbpbackup';
  if (name.endsWith('.sbp')) return 'sbp';
  if (name.endsWith('.onsong')) return 'onsong';
  if (startsWith(bytes, ZIP_MAGIC)) return name.endsWith('.zip') ? 'sbp' : 'sbp';
  if (name.endsWith('.cho') || name.endsWith('.chopro') || name.endsWith('.crd') || name.endsWith('.pro')) {
    return 'chordpro';
  }
  const text = headText(bytes);
  if (looksLikeChordPro(text)) return 'chordpro';
  if (name.endsWith('.txt') && text.trim()) return 'chordpro';
  return 'unknown';
}

export function formatImportLabel(format: ImportFormat) {
  switch (format) {
    case 'sbp':
      return 'Songbook Pro set';
    case 'sbpbackup':
      return 'Songbook Pro backup';
    case 'chordpro':
      return 'ChordPro chart';
    case 'onsong':
      return 'OnSong chart';
    case 'pdf':
      return 'PDF';
    default:
      return 'Unknown file';
  }
}
