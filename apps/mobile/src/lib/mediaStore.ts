import { Platform } from 'react-native';

function bytesToBase64(bytes: Uint8Array) {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Copy a PDF or audio blob into app documents. Returns a file URI. */
export async function persistMediaFile(
  kind: 'pdf' | 'audio',
  bytes: Uint8Array,
  ext: string,
  hash: string,
): Promise<string> {
  const safe = hash.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80) || 'media';
  const filename = `${kind}-${safe}.${ext.replace(/^\./, '')}`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const mime = kind === 'pdf' ? 'application/pdf' : 'audio/*';
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    return URL.createObjectURL(blob);
  }

  const FileSystem = await import('expo-file-system/legacy');
  const dir = `${FileSystem.documentDirectory}media/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export async function openLocalMedia(uri: string, mime: string, title?: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    window.open(uri, '_blank');
    return;
  }
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: title ?? 'Open', UTI: mime });
  }
}
