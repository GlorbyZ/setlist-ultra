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
npm install
cp .env.example apps/mobile/.env   # add Google client IDs

npm run preflight                  # monorepo + Metro/Babel checks
npm run ug-proxy                   # terminal 1 — UG import
npm run mobile                     # terminal 2 — Expo / Metro
# After native Gradle builds: npm run mobile:clear
```

Full process: **[docs/BUILD.md](docs/BUILD.md)**

## Download APK

**Latest:** https://github.com/GlorbyZ/setlist-ultra/releases/latest — `setlist-ultra-android.apk`

```bash
npm run preflight && npm run typecheck   # before tagging
git tag v0.1.3 && git push origin v0.1.3 # CI builds release APK
```

See **[docs/BUILD.md](docs/BUILD.md)** for Metro dev, local builds, and smoke tests.

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
