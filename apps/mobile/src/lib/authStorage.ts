import * as SecureStore from 'expo-secure-store';

/** Android SecureStore rejects values over ~2KB; session JWTs are larger. */
const CHUNK = 1800;

function countKey(key: string) {
  return `${key}.chunks`;
}

function partKey(key: string, index: number) {
  return `${key}.${index}`;
}

async function deleteParts(key: string) {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const count = raw ? Number(raw) : 0;
  const jobs = [SecureStore.deleteItemAsync(countKey(key)), SecureStore.deleteItemAsync(key)];
  if (Number.isFinite(count) && count > 0) {
    for (let i = 0; i < count; i += 1) jobs.push(SecureStore.deleteItemAsync(partKey(key, i)));
  }
  await Promise.all(jobs.map((job) => job.catch(() => undefined)));
}

export const authStorage = {
  getItem: async (key: string) => {
    const raw = await SecureStore.getItemAsync(countKey(key));
    const count = raw ? Number(raw) : 0;
    if (Number.isFinite(count) && count > 0) {
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(partKey(key, i));
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join('');
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await deleteParts(key);
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK);
    await SecureStore.setItemAsync(countKey(key), String(count));
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(partKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
  },
  removeItem: async (key: string) => {
    await deleteParts(key);
  },
};
