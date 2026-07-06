# Setlist Ultra

Offline-first digital songbook and setlist manager for gigging musicians.

## V1 features

- Local song library (SQLite)
- Ultimate Guitar import via proxy
- Chord-over-lyric viewer with live transpose and capo
- Basic setlists
- Google Drive connection (OAuth scaffold + folder setup)

## Quick start

```bash
# Install dependencies
npm install

# Copy env and add your Google Web Client ID
cp .env.example apps/mobile/.env

# Link expo-router for npm workspaces (macOS/Linux; Windows start script does this automatically)
./apps/mobile/scripts/ensure-expo-router-link.sh

# Start UG import proxy (separate terminal)
npm run ug-proxy

# Start mobile app
npm run mobile
```

## Download APK

**Always on GitHub:** [Latest release](https://github.com/GlorbyZ/setlist-ultra/releases/latest) — download `setlist-ultra-android.apk`.

New APKs are published automatically when a `v*` tag is pushed (see `.github/workflows/android-release.yml`).

- **EAS builds (backup):** https://expo.dev/accounts/zayyo/projects/setlist-ultra/builds
- **Release notes:** [RELEASE.md](RELEASE.md)

### Build APK locally (Windows)

```bash
npm run android:apk
```

Output: `releases/setlist-ultra-0.1.0-debug.apk` (requires JDK 17 + Android SDK; script maps `S:` on Windows to avoid path-length limits).

## Public repository

```bash
git clone https://github.com/GlorbyZ/setlist-ultra.git
cd setlist-ultra
npm install
```

Same distribution model as [R34 Pro](https://github.com/GlorbyZ/R34Pro): public GitHub repo, clone or download ZIP, then build/run locally.

### Android dev build

```bash
cd apps/mobile
npx expo run:android
```

## Project layout

- `apps/mobile` — Expo app (iOS, Android, web)
- `packages/core` — Song AST, UG normalizer, transpose
- `packages/db` — Drizzle + SQLite schema
- `services/ug-proxy` — Ultimate Guitar tab import API

## Google Drive setup

1. Enable Google Drive API in Google Cloud Console
2. Configure OAuth consent screen (Testing mode + test users)
3. Create Web + Android OAuth clients
4. Add `EXPO_PUBLIC_GOOGLE_*` vars to `apps/mobile/.env`

Package name: `com.setlistultra.app`
