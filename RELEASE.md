# Releases

**Process guide:** [docs/BUILD.md](docs/BUILD.md)

## Download

**Latest:** https://github.com/GlorbyZ/setlist-ultra/releases/latest → `setlist-ultra-android.apk`

## Publish a release

```bash
npm run preflight
npm run typecheck
git tag v0.1.3
git push origin v0.1.3
```

GitHub Actions (`.github/workflows/android-release.yml`) will:

1. Run preflight (Metro/Babel/monorepo invariants)
2. Build `assembleRelease` with embedded JS bundle
3. Verify the APK contains a bundle (rejects debug-style builds)
4. Attach `setlist-ultra-android.apk` to the GitHub Release

Manual CI run (no tag): **Actions → Android APK Release → Run workflow** → download artifact.

## Smoke test (required)

- [ ] Uninstall previous APK
- [ ] Install new `setlist-ultra-android.apk`
- [ ] App opens to Songs tab with demo song
- [ ] No instant crash / endless splash

## EAS (backup)

https://expo.dev/accounts/zayyo/projects/setlist-ultra/builds

## Local Windows build (optional)

```bash
npm run preflight
npm run android:apk
```

Output: `releases/setlist-ultra-android.apk` — verified for embedded bundle.

**Never distribute** `npm run android:apk:debug` — requires Metro on your PC.
