import { isCatalogConfigured, isHostedConfigured, isManagerConfigured } from './config';

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return fallback;
}

/**
 * First Play freeze: core library/Live stays on.
 * Optional surfaces need an explicit env opt-in in release builds.
 */
export const launchFlags = {
  /** BYOK AI tab + settings. Off in store binaries unless EXPO_PUBLIC_LAUNCH_AI=1. */
  get ai() {
    return envFlag('EXPO_PUBLIC_LAUNCH_AI', typeof __DEV__ !== 'undefined' && __DEV__);
  },
  /** Camera/image “scan” placeholder. Not OCR. */
  get scan() {
    return envFlag('EXPO_PUBLIC_LAUNCH_SCAN', typeof __DEV__ !== 'undefined' && __DEV__);
  },
  /** Ultimate Guitar proxy search/import. */
  get catalog() {
    return isCatalogConfigured();
  },
  /** Hosted sync / Google sign-in. */
  get cloud() {
    return isHostedConfigured();
  },
  /** LAN Manager snapshot. */
  get manager() {
    return isManagerConfigured();
  },
  /** Local backing-track attach + Live playback. */
  get audio() {
    return envFlag('EXPO_PUBLIC_LAUNCH_AUDIO', true);
  },
};
