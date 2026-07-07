# Build & dev process (Metro + Android APK)

Single source of truth for how Setlist Ultra is run and shipped. **Read this before changing Metro, Gradle, or release scripts.**

## Golden rules

1. **Users get release APKs only** — `assembleRelease` embeds the JS bundle. Debug APKs need Metro on your PC and will not start on a phone alone.
2. **GitHub Actions owns releases** — Tag `v*` → CI builds on Ubuntu → asset `setlist-ultra-android.apk`. Prefer this over Windows Gradle for shipping.
3. **Run preflight before Metro or APK builds** — `npm run preflight` fixes monorepo links and validates required config.
4. **Never `gradlew clean` on Windows via `S:`** — Mixed `S:` / `C:` paths break codegen. Rebuild with `assembleRelease` only, or delete `apps/mobile/android` and re-prebuild if stuck.
5. **After a local Gradle build, restart Metro** — Native `android/build` dirs can crash the file watcher; Metro config blocks them, but restart with `npm run mobile:clear` if bundling fails.

## Daily dev (Metro)

```bash
# Terminal 1 — UG proxy (optional, for import)
npm run ug-proxy

# Terminal 2 — Expo / Metro
npm run preflight
npm run mobile          # or: npm run mobile:clear after native builds
```

- Web: http://localhost:8081 or press `w` in the Expo terminal
- USB device: press `a` (needs `adb devices` showing a device)
- If port 8081 is busy, stop the old Metro process first

### Monorepo requirements (do not remove)

| File | Why |
|------|-----|
| `apps/mobile/metro.config.js` | `extraNodeModules` for `@setlist-ultra/*`, `wasm` in `assetExts`, `blockList` for `android/build` |
| `apps/mobile/babel.config.js` | `react-native-reanimated/plugin` (must be last plugin) |
| `apps/mobile/scripts/ensure-expo-router-link.*` | Root `node_modules/expo-router` junction/symlink for Expo CLI |
| `apps/mobile/scripts/preflight.*` | Runs checks + link before start/build |

## Ship an APK (recommended)

```bash
git tag v0.1.3
git push origin v0.1.3
```

CI workflow `.github/workflows/android-release.yml` builds and attaches `setlist-ultra-android.apk`.

**Before tagging:** run `npm run preflight` and `npm run typecheck` on `main`.

**After CI finishes:** install on device, confirm app opens to the song list (smoke test below).

## Local APK (Windows — dev/debug only)

```bash
npm run preflight
npm run android:apk          # release → releases/setlist-ultra-android.apk
npm run android:apk:debug    # dev only — requires npm run mobile on PC
```

Requires JDK 17 + Android SDK. Long paths use drive `S:` → repo root automatically.

## Smoke test (required before calling a release good)

- [ ] Uninstall previous Setlist Ultra APK
- [ ] Install `setlist-ultra-android.apk` from GitHub Releases
- [ ] App opens (not instant close / endless splash)
- [ ] Demo song visible on Songs tab
- [ ] Optional: UG import with proxy on PC + `EXPO_PUBLIC_UG_PROXY_URL` set to LAN IP in `.env` before build

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Metro: `wa-sqlite.wasm` | `wasm` missing from `metro.config.js` `assetExts` — run `npm run preflight` |
| Metro: `@setlist-ultra/core` | `extraNodeModules` / monorepo root detection — run `npm run preflight` |
| Expo CLI: `expo-router/_ctx-shared` | Run `npm run preflight` (junction at repo root) |
| App crashes on launch (release) | Missing Reanimated Babel plugin — check `babel.config.js` |
| Gradle MAX_PATH on Windows | Build uses `S:` subst; or clone to `C:\slu` |
| Gradle after clean fails | Avoid clean on subst; delete `android/` and `npx expo prebuild --platform android` |
| Metro dies after Gradle | `npm run mobile:clear` |

## References

- [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/)
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [Reanimated install](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/)
