# Setlist Ultra — mobile app (agents)

**Always read** `../../docs/BUILD.md` before changing Metro, Babel, Gradle, CI, or release scripts.

Expo SDK **57** — versioned docs: https://docs.expo.dev/versions/v57.0.0/

## Non-negotiables

- **Never ship debug APKs to users.** `assembleDebug` does not embed JS. Default `android:apk` is **release**.
- **Never delete or simplify** `metro.config.js` monorepo settings: `findMonorepoRoot`, `extraNodeModules`, `wasm` in `assetExts`, `blockList` for `android/build`.
- **Never remove** `react-native-reanimated/plugin` from `babel.config.js` (must remain the last plugin).
- **Never run `gradlew clean` on Windows** when using `S:` subst — use `assembleRelease` or re-prebuild `android/`.
- **Primary release path:** git tag `v*` → GitHub Actions → `setlist-ultra-android.apk`. Do not commit `releases/*.apk`.

## Before starting Metro

```bash
npm run preflight --workspace=mobile
npm run mobile
```

Or from repo root: `npm run preflight && npm run mobile`

## Before building APK locally

```bash
npm run preflight
npm run android:apk
```

Release builds run `verify-apk` — APK must contain an embedded JS bundle.

## Monorepo layout

- `apps/mobile` — Expo Router app
- `packages/core` — song AST, UG normalizer, transpose (`@setlist-ultra/core`)
- `packages/db` — Drizzle schema (`@setlist-ultra/db`)
- `services/ug-proxy` — separate process, not bundled in app

Imports from workspace packages require Metro `extraNodeModules` (already configured).

## Common mistakes (do not repeat)

| Mistake | Consequence |
|---------|-------------|
| Debug APK on GitHub Releases | App installs but does not start |
| Missing Reanimated Babel plugin | Instant native crash on launch |
| No `wasm` in Metro `assetExts` | Web/SSR bundle fails on expo-sqlite |
| No expo-router root link | `expo start` crashes on typed routes |
| Hoisting expo-router to root `package.json` without resolving peers | npm ERESOLVE conflicts |

## Device / env

- `apps/mobile/.env` — `EXPO_PUBLIC_*` vars (gitignored)
- Physical device + UG import: proxy URL must be PC **LAN IP**, not `localhost`
