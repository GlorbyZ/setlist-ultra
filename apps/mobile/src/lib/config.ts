import Constants from 'expo-constants';

function extra(name: string): string {
  const value = Constants.expoConfig?.extra?.[name];
  if (typeof value !== 'string' || !value || value.includes('${')) return '';
  return value;
}

const DEFAULT_UG_PROXY = 'https://ug.bigzay.com';

function resolveUgProxyUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_UG_PROXY_URL || extra('ugProxyUrl');
  const isLocal = !fromEnv || /localhost|127\.0\.0\.1/i.test(fromEnv);
  if (isLocal && !__DEV__) return DEFAULT_UG_PROXY;
  return fromEnv || DEFAULT_UG_PROXY;
}

export const config = {
  googleWebClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra('googleWebClientId') ?? '',
  googleAndroidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? extra('googleAndroidClientId') ?? '',
  ugProxyUrl: resolveUgProxyUrl(),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra('supabaseUrl') ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra('supabaseAnonKey') ?? '',
  managerUrl: process.env.EXPO_PUBLIC_MANAGER_URL ?? extra('managerUrl') ?? 'http://localhost:3848',
  webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL ?? extra('webAppUrl') ?? '',
};

export function isHostedConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
