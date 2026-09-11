import { Platform } from 'react-native';
import { IMPORT_LIMITS } from '@setlist-ultra/core';

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export async function readBytesFromUri(uri: string): Promise<Uint8Array> {
  const FileSystem = await import('expo-file-system/legacy');
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  const size = info && 'size' in info && typeof info.size === 'number' ? info.size : undefined;
  if (info && 'exists' in info && info.exists === false) {
    throw new Error('The file is no longer available.');
  }
  if (size === 0) throw new Error('The file was empty or could not be read.');

  const chunk = 256 * 1024;
  if (size && size > chunk) {
    const parts: Uint8Array[] = [];
    for (let position = 0; position < size; position += chunk) {
      const length = Math.min(chunk, size - position);
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        position,
        length,
      });
      parts.push(decodeBase64(b64));
    }
    const bytes = concatBytes(parts);
    if (!bytes.byteLength) throw new Error('The file was empty or could not be read.');
    return bytes;
  }

  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = decodeBase64(b64);
  if (!bytes.byteLength) throw new Error('The file was empty or could not be read.');
  return bytes;
}

/** Android SAF/content URIs often fail through a single read path. Try cache, copy, then fetch. */
export async function readImportBytes(uri: string): Promise<Uint8Array> {
  const errors: string[] = [];
  try {
    return await readBytesFromUri(uri);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'cache read failed');
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    if (FileSystem.cacheDirectory) {
      const dest = `${FileSystem.cacheDirectory}import-${Date.now()}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      return await readBytesFromUri(dest);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'copy failed');
  }

  try {
    const response = await fetch(uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength) return bytes;
    errors.push('network read was empty');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'fetch failed');
  }

  throw new Error(errors[0] || 'The file was empty or could not be read.');
}

export async function pickBinaryFile(accept = '.sbp,.sbpbackup,.cho,.chopro,.crd,.onsong,.pro,.txt,.zip,.pdf,.mp3,.m4a,.wav,.aac'): Promise<{
  name: string;
  bytes: Uint8Array;
} | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        if (file.size > IMPORT_LIMITS.maxUncompressedBytes) {
          reject(new Error('This file is too large to import safely.'));
          return;
        }
        resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      };
      input.click();
    });
  }

  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/octet-stream', 'text/plain', 'application/pdf', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  // Some Android builds mark the result canceled but still return the picked asset.
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  if (typeof asset.size === 'number' && asset.size > IMPORT_LIMITS.maxUncompressedBytes) {
    throw new Error('This file is too large to import safely.');
  }
  const bytes = await readImportBytes(asset.uri);
  if (!bytes.byteLength) {
    throw new Error('The file was empty or could not be read.');
  }
  return { name: asset.name ?? 'import.sbp', bytes };
}

export async function saveBinaryFile(filename: string, bytes: Uint8Array, mime = 'application/zip') {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename, UTI: 'public.zip-archive' });
  }
}

export async function pickImage(): Promise<{ uri: string; name: string } | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.status !== 'granted') {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    if (!camera.granted) return null;
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (shot.canceled || !shot.assets[0]) return null;
    return { uri: shot.assets[0].uri, name: shot.assets[0].fileName ?? 'scan.jpg' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  return { uri: result.assets[0].uri, name: result.assets[0].fileName ?? 'chart.jpg' };
}
