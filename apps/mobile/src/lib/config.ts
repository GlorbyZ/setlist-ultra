import Constants from 'expo-constants';

function extra(name: string): string {
  return (Constants.expoConfig?.extra?.[name] as string | undefined) ?? '';
}

export const config = {
  googleWebClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra('googleWebClientId') ?? '',
  googleAndroidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? extra('googleAndroidClientId') ?? '',
  ugProxyUrl:
    process.env.EXPO_PUBLIC_UG_PROXY_URL ?? extra('ugProxyUrl') ?? 'http://localhost:8787',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra('supabaseUrl') ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra('supabaseAnonKey') ?? '',
  managerUrl: process.env.EXPO_PUBLIC_MANAGER_URL ?? extra('managerUrl') ?? 'http://localhost:3848',
  webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL ?? extra('webAppUrl') ?? '',
};

export function isHostedConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
