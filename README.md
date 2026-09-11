# Setlist Ultra

Offline-first digital songbook for iOS, Android, and web. Songbook Pro–class Songs / Sets / Live / Editor with `.sbp` / `.sbpbackup` round-trip and an optional hosted catalog.

## Features

- One Expo 57 app: Songs, Sets, Live (gallery swipe, Key/Capo, section jump, autoscroll), ChordPro editor
- Import/export Songbook Pro `.sbp` (set share) and `.sbpbackup` (full library)
- Ultimate Guitar import via proxy, ChordPro paste, camera/image scan
- Local SQLite catalog (dedupe by content hash). Optional Supabase auth + Groups
- HID pedal page-turns, print/PDF, LAN Manager snapshot (`npm run manager`)

Gig-parity vs Songbook Pro (what is on device vs what is next): **[docs/SBP-UI-PARITY-PLAN.md](docs/SBP-UI-PARITY-PLAN.md)**

## Quick start

```bash
npm install
npm run preflight                  # monorepo + Metro/Babel checks
npm run ug-proxy                   # terminal 1 — UG import (optional)
npm run mobile                     # terminal 2 — Expo / Metro
# Web: press w   After native Gradle builds: npm run mobile:clear
```

Full process: **[docs/BUILD.md](docs/BUILD.md)** · Hosted catalog: **[services/api/README.md](services/api/README.md)**

## Download APK

**Latest:** https://github.com/GlorbyZ/setlist-ultra/releases/latest — `setlist-ultra-android.apk`

```bash
npm run preflight && npm run typecheck && npm test
git tag v5.0.4 && git push origin v5.0.4
```

## Project layout

- `apps/mobile` — Expo Router (iOS, Android, web)
- `packages/core` — ChordPro, SBP packer, AST, transpose, Live section jump targets
- `packages/db` — Drizzle + SQLite schema
- `packages/api` — Supabase client
- `services/ug-proxy` — Ultimate Guitar import
- `services/api` — Hosted SQL
- `services/manager` — LAN Manager host
