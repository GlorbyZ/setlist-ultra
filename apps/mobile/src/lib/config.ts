import Constants from 'expo-constants';

export const config = {
  googleWebClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ??
    '',
  googleAndroidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    (Constants.expoConfig?.extra?.googleAndroidClientId as string | undefined) ??
    '',
  ugProxyUrl:
    process.env.EXPO_PUBLIC_UG_PROXY_URL ??
    (Constants.expoConfig?.extra?.ugProxyUrl as string | undefined) ??
    'http://localhost:8787',
};
