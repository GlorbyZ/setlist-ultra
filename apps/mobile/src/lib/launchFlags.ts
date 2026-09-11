import Constants from 'expo-constants';

import { isCatalogConfigured, isHostedConfigured, isManagerConfigured } from './config';
import { resolveBinaryFlag, sanitizeConfigValue } from './configValidate';

function extra(name: string): string {
  return sanitizeConfigValue(Constants.expoConfig?.extra?.[name]);
}

/**
 * First Play freeze: core library/Live stays on.
 * Optional surfaces need an explicit env/extra opt-in in release builds.
 *
 * Read `process.env.EXPO_PUBLIC_*` with a static member name so Metro can inline it,
 * and fall back to `extra` baked at prebuild (GitHub APKs set these in CI).
 */
export const launchFlags = {
  /** BYOK AI tab + settings. Off in store binaries unless EXPO_PUBLIC_LAUNCH_AI=1. */
  get ai() {
    return resolveBinaryFlag(
      process.env.EXPO_PUBLIC_LAUNCH_AI,
      extra('launchAi'),
      typeof __DEV__ !== 'undefined' && __DEV__,
    );
  },
  /** Camera/image “scan” placeholder. Not OCR. */
  get scan() {
    return resolveBinaryFlag(
      process.env.EXPO_PUBLIC_LAUNCH_SCAN,
      extra('launchScan'),
      typeof __DEV__ !== 'undefined' && __DEV__,
    );
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
    return resolveBinaryFlag(process.env.EXPO_PUBLIC_LAUNCH_AUDIO, extra('launchAudio'), true);
  },
};
