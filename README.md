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

# Start UG import proxy (separate terminal)
npm run ug-proxy

# Start mobile app
npm run mobile
```

## Download APK

- **Latest cloud build:** https://expo.dev/accounts/zayyo/projects/setlist-ultra/builds
- **Release notes:** see [RELEASE.md](RELEASE.md)

## Public repository

```bash
git clone https://github.com/zayyo/setlist-ultra.git
```

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
