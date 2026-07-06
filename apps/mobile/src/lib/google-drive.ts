import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { config } from './config';
import { saveSyncState } from './repository';

WebBrowser.maybeCompleteAuthSession();

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function useGoogleDriveAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: config.googleWebClientId || undefined,
    androidClientId: config.googleAndroidClientId || undefined,
    scopes: [DRIVE_SCOPE, 'openid', 'profile', 'email'],
  });

  return { request, response, promptAsync };
}

export async function persistGoogleTokens(
  accessToken?: string | null,
  refreshToken?: string | null,
  email?: string,
) {
  if (!accessToken) return;

  await saveSyncState({
    provider: 'google_drive',
    accountEmail: email,
    accessToken,
    refreshToken: refreshToken ?? undefined,
    tokenExpiry: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
}

export async function ensureSetlistUltraFolder(accessToken: string) {
  const query = encodeURIComponent(
    "name = 'SetlistUltra' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
  );

  const search = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!search.ok) {
    throw new Error('Failed to search Drive');
  }

  const searchData = (await search.json()) as { files: { id: string; name: string }[] };
  if (searchData.files?.[0]) {
    return searchData.files[0].id;
  }

  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'SetlistUltra',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!create.ok) {
    throw new Error('Failed to create SetlistUltra folder');
  }

  const created = (await create.json()) as { id: string };
  return created.id;
}
