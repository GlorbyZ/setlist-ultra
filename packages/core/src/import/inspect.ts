export const IMPORT_LIMITS = {
  maxEntries: 4000,
  maxUncompressedBytes: 80 * 1024 * 1024,
  maxCompressionRatio: 80,
};

export function inspectUnzippedArchive(files: Record<string, Uint8Array>, compressedBytes: number) {
  const names = Object.keys(files);
  if (names.length > IMPORT_LIMITS.maxEntries) {
    throw new Error(`Archive has too many files (${names.length}).`);
  }
  let uncompressed = 0;
  for (const name of names) {
    const normalized = name.replace(/\\/g, '/');
    if (normalized.includes('..') || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
      throw new Error('Archive contains an unsafe path.');
    }
    uncompressed += files[name]?.byteLength ?? 0;
  }
  if (uncompressed > IMPORT_LIMITS.maxUncompressedBytes) {
    throw new Error('Archive is too large to import safely.');
  }
  if (compressedBytes > 2048 && uncompressed / compressedBytes > IMPORT_LIMITS.maxCompressionRatio) {
    throw new Error('Archive compression ratio looks unsafe.');
  }
}
