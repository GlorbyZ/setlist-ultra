import { Platform } from 'react-native';

export async function pickBinaryFile(accept = '.sbp,.sbpbackup,.cho,.chopro,.crd,.txt,.zip'): Promise<{
  name: string;
  bytes: Uint8Array;
} | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      };
      input.click();
    });
  }

  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const buffer = await response.arrayBuffer();
  return { name: asset.name ?? 'import.sbp', bytes: new Uint8Array(buffer) };
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

export async function readBytesFromUri(uri: string): Promise<Uint8Array> {
  const FileSystem = await import('expo-file-system/legacy');
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
