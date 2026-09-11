/** Pure config checks — safe for node:test without Expo. */

export function sanitizeConfigValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('${')) return '';
  if (/^\$\{?EXPO_PUBLIC_[A-Z0-9_]+\}?$/.test(trimmed)) return '';
  return trimmed;
}

export function isUnresolvedPlaceholder(value: string): boolean {
  return sanitizeConfigValue(value) === '' && typeof value === 'string' && value.trim().length > 0;
}

export function isUsableHttpUrl(value: string): boolean {
  const cleaned = sanitizeConfigValue(value);
  if (!cleaned) return false;
  try {
    const url = new URL(cleaned);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isPublicServiceUrl(value: string): boolean {
  if (!isUsableHttpUrl(value)) return false;
  const host = new URL(sanitizeConfigValue(value)).hostname;
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
}

/** Release binaries only enable optional surfaces when env/extra is an explicit yes. */
export function resolveBinaryFlag(envValue: unknown, extraValue: unknown, isDev: boolean): boolean {
  const raw = (sanitizeConfigValue(envValue) || sanitizeConfigValue(extraValue)).toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return isDev;
}
