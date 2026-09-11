import Constants from 'expo-constants';

import { isPublicServiceUrl, isUsableHttpUrl, sanitizeConfigValue } from './configValidate';

function extra(name: string): string {
  return sanitizeConfigValue(Constants.expoConfig?.extra?.[name]);
}

function fromEnv(name: string): string {
  return sanitizeConfigValue(process.env[name]);
}

function resolveUgProxyUrl() {
  const fromEnvOrExtra = fromEnv('EXPO_PUBLIC_UG_PROXY_URL') || extra('ugProxyUrl');
  if (!isUsableHttpUrl(fromEnvOrExtra)) return '';
  if (typeof __DEV__ !== 'undefined' && !__DEV__ && !isPublicServiceUrl(fromEnvOrExtra)) return '';
  return fromEnvOrExtra.replace(/\/$/, '');
}

function resolveManagerUrl() {
  const value = fromEnv('EXPO_PUBLIC_MANAGER_URL') || extra('managerUrl');
  if (!isUsableHttpUrl(value)) return '';
  if (typeof __DEV__ !== 'undefined' && !__DEV__ && !isPublicServiceUrl(value)) return '';
  return value.replace(/\/$/, '');
}

function resolveAiGatewayUrl() {
  const value = fromEnv('EXPO_PUBLIC_AI_GATEWAY_URL') || extra('aiGatewayUrl');
  if (!isUsableHttpUrl(value)) return '';
  if (typeof __DEV__ !== 'undefined' && !__DEV__ && !isPublicServiceUrl(value)) return '';
  return value.replace(/\/$/, '');
}

export const config = {
  googleWebClientId: fromEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') || extra('googleWebClientId'),
  googleAndroidClientId: fromEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') || extra('googleAndroidClientId'),
  ugProxyUrl: resolveUgProxyUrl(),
  aiGatewayUrl: resolveAiGatewayUrl(),
  aiGatewayToken: fromEnv('EXPO_PUBLIC_AI_GATEWAY_TOKEN') || extra('aiGatewayToken'),
  supabaseUrl: fromEnv('EXPO_PUBLIC_SUPABASE_URL') || extra('supabaseUrl'),
  supabaseAnonKey: fromEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') || extra('supabaseAnonKey'),
  managerUrl: resolveManagerUrl(),
  webAppUrl: fromEnv('EXPO_PUBLIC_WEB_APP_URL') || extra('webAppUrl'),
  privacyPolicyUrl: fromEnv('EXPO_PUBLIC_PRIVACY_URL') || extra('privacyPolicyUrl'),
  supportEmail: fromEnv('EXPO_PUBLIC_SUPPORT_EMAIL') || extra('supportEmail') || 'z@blazedigitaldesign.com',
};

export function isHostedConfigured(): boolean {
  return isPublicServiceUrl(config.supabaseUrl) && Boolean(config.supabaseAnonKey.trim());
}

export function isCatalogConfigured(): boolean {
  return isPublicServiceUrl(config.ugProxyUrl);
}

export function isAiGatewayConfigured(): boolean {
  return isPublicServiceUrl(config.aiGatewayUrl);
}

export function isManagerConfigured(): boolean {
  return isUsableHttpUrl(config.managerUrl);
}
