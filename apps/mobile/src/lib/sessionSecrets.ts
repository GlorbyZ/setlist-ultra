import * as SecureStore from 'expo-secure-store';

function accessKey(provider: string) {
  return `setlist-ultra.auth.${provider}.access`;
}

function refreshKey(provider: string) {
  return `setlist-ultra.auth.${provider}.refresh`;
}

async function readItem(key: string): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

async function writeItem(key: string, value: string | null | undefined) {
  if (value === undefined) return;
  try {
    if (value == null || !value.trim()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* web / SecureStore unavailable */
  }
}

/** Provider-scoped session secrets. undefined = keep, null/empty = clear, string = replace. */
export async function writeSessionSecrets(
  provider: string,
  patch: { accessToken?: string | null; refreshToken?: string | null },
) {
  if (!provider || provider === 'local') return;
  if (patch.accessToken !== undefined) await writeItem(accessKey(provider), patch.accessToken);
  if (patch.refreshToken !== undefined) await writeItem(refreshKey(provider), patch.refreshToken);
}

export async function readSessionSecrets(provider: string | null | undefined) {
  if (!provider || provider === 'local') {
    return { accessToken: null as string | null, refreshToken: null as string | null };
  }
  return {
    accessToken: await readItem(accessKey(provider)),
    refreshToken: await readItem(refreshKey(provider)),
  };
}
