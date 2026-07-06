# Releases

## Download the Android APK

### Option A — Latest EAS build (recommended)

1. Open the [Expo builds page](https://expo.dev/accounts/zayyo/projects/setlist-ultra/builds)
2. Open the latest **preview** Android build
3. Tap **Download** to get the `.apk`

### Option B — GitHub Releases

When a release is published on GitHub, download `setlist-ultra-android.apk` from the **Assets** section.

### Option C — Build locally

```bash
cd apps/mobile
npx expo run:android --variant release
```

APK output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## Install on Android

1. Enable **Install unknown apps** for your browser/files app
2. Open the downloaded APK
3. For UG import on a physical device, run the proxy on your PC and set `EXPO_PUBLIC_UG_PROXY_URL` to your PC LAN IP before building

## Clone source

```bash
git clone https://github.com/zayyo/setlist-ultra.git
cd setlist-ultra
npm install
```
