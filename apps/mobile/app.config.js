function sanitize(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('${')) return '';
  return trimmed;
}

function fromEnv(name, fallback) {
  return sanitize(process.env[name]) || sanitize(fallback) || '';
}

/** Dynamic Expo config. extra values come from EXPO_PUBLIC_* at build time, never unresolved ${} placeholders. */
module.exports = ({ config }) => {
  const extra = config.extra ?? {};
  return {
    ...config,
    extra: {
      ...extra,
      googleWebClientId: fromEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', extra.googleWebClientId),
      googleAndroidClientId: fromEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', extra.googleAndroidClientId),
      ugProxyUrl: fromEnv('EXPO_PUBLIC_UG_PROXY_URL', extra.ugProxyUrl),
      supabaseUrl: fromEnv('EXPO_PUBLIC_SUPABASE_URL', extra.supabaseUrl),
      supabaseAnonKey: fromEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', extra.supabaseAnonKey),
      managerUrl: fromEnv('EXPO_PUBLIC_MANAGER_URL', extra.managerUrl),
      webAppUrl: fromEnv('EXPO_PUBLIC_WEB_APP_URL', extra.webAppUrl),
      privacyPolicyUrl: fromEnv('EXPO_PUBLIC_PRIVACY_URL', extra.privacyPolicyUrl),
      supportEmail: fromEnv('EXPO_PUBLIC_SUPPORT_EMAIL', extra.supportEmail) || 'epicnigs3@gmail.com',
    },
  };
};
