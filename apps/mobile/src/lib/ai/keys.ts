import * as SecureStore from 'expo-secure-store';

import { isAiGatewayConfigured } from '@/src/lib/config';

import { AI_PROVIDERS, type AiProviderId } from './types';

const PROVIDER_KEY = 'setlist-ultra.ai.provider';
const PREFER_BYOK_KEY = 'setlist-ultra.ai.preferByok';
const keyStoreKey = (provider: AiProviderId) => `setlist-ultra.ai.key.${provider}`;

export function isAiProviderId(value: unknown): value is AiProviderId {
  return value === 'gemini' || value === 'openai' || value === 'anthropic';
}

export async function getAiProvider(): Promise<AiProviderId> {
  try {
    const raw = await SecureStore.getItemAsync(PROVIDER_KEY);
    if (isAiProviderId(raw)) return raw;
  } catch {
    /* web / unavailable */
  }
  return 'gemini';
}

export async function setAiProvider(provider: AiProviderId): Promise<void> {
  try {
    await SecureStore.setItemAsync(PROVIDER_KEY, provider);
  } catch {
    /* ignore */
  }
}

export async function getAiApiKey(provider: AiProviderId): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(keyStoreKey(provider));
    return value?.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export async function setAiApiKey(provider: AiProviderId, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  try {
    if (!trimmed) {
      await SecureStore.deleteItemAsync(keyStoreKey(provider));
      return;
    }
    await SecureStore.setItemAsync(keyStoreKey(provider), trimmed);
  } catch {
    /* ignore */
  }
}

export async function hasAiApiKey(provider?: AiProviderId): Promise<boolean> {
  const id = provider ?? (await getAiProvider());
  const key = await getAiApiKey(id);
  return Boolean(key);
}

export async function getPreferByok(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(PREFER_BYOK_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function setPreferByok(value: boolean): Promise<void> {
  try {
    if (value) await SecureStore.setItemAsync(PREFER_BYOK_KEY, '1');
    else await SecureStore.deleteItemAsync(PREFER_BYOK_KEY);
  } catch {
    /* ignore */
  }
}

/** Hosted gateway, or an explicit BYOK key. */
export async function hasAiAccess(provider?: AiProviderId): Promise<boolean> {
  if (isAiGatewayConfigured() && !(await getPreferByok())) return true;
  return hasAiApiKey(provider);
}

export function providerMeta(id: AiProviderId) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

/** Mask for UI — never log the raw key. */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '';
  const t = key.trim();
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
