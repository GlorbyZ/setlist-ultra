# Releases

## Download the Android APK (GitHub — primary)

**Latest:** https://github.com/GlorbyZ/setlist-ultra/releases/latest

Download **`setlist-ultra-android.apk`** from the release assets.

### How new releases are published

1. Tag a version: `git tag v0.1.0 && git push origin v0.1.0`
2. GitHub Actions builds the APK on Ubuntu and attaches it to the GitHub Release.

You can also trigger a build manually: **Actions → Android APK Release → Run workflow**.

### EAS cloud build (backup)

1. Open the [Expo builds page](https://expo.dev/accounts/zayyo/projects/setlist-ultra/builds)
2. Open the latest **preview** Android build
3. Tap **Download** to get the `.apk`

### Build locally (Windows)

```bash
npm run android:apk
```

Requires JDK 17 and Android SDK. The build script maps drive `S:` when paths hit Windows’ 260-character limit.

APK output: `releases/setlist-ultra-0.1.0-release.apk` (and `setlist-ultra-android.apk` for GitHub)

**Note:** Debug APKs (`--debug`) require Metro on your PC and will not start on a phone alone. Always ship **release** builds for sideloading.

### Build locally (macOS / Linux)

```bash
cd apps/mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

APK output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## Install on Android

1. Enable **Install unknown apps** for your browser/files app
2. Open the downloaded APK
3. For UG import on a physical device, run the proxy on your PC and set `EXPO_PUBLIC_UG_PROXY_URL` to your PC LAN IP before building

## Clone source

```bash
git clone https://github.com/GlorbyZ/setlist-ultra.git
cd setlist-ultra
npm install
```
