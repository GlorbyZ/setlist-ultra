# Store listing & Data safety — Setlist Ultra

Paste into Play Console / App Store Connect. Do not claim Songbook Pro affiliation, native MIDI on phones, in-app PDF annotation, lossless media backup, or catalog availability beyond what the binary actually enables.

## Create app (Play Console)

Package name is permanent after this screen. Fill:

| Field | Value |
|---|---|
| App name | Setlist Ultra |
| Package name | `com.setlistultra.app` |
| Default language | English (United States) – en-US |
| App or game | **App** |
| Free or paid | **Free** (cannot switch to paid after publish) |

Later in Store settings: support **z@blazedigitaldesign.com**. Contains ads: **No**. Target audience: 13+ (not designed for children). Privacy policy URL: https://github.com/GlorbyZ/setlist-ultra/blob/main/docs/privacy.md

**Title:** Setlist Ultra  
**Short description:** Your songs, setlists, and chord charts—ready for the stage.  
**Opening / long description:**

Organize your own song library, prepare setlists, and read chord charts while you play. Keep your saved music available offline and adjust key and capo for your performance.

Import ChordPro and Songbook Pro `.sbp` / `.sbpbackup` files, edit charts, and swipe through Live pages on stage. Pedal page-turns use standard keyboard events (Page Up/Down and arrows).

GitHub APKs and Google Play builds use different signing keys. Uninstall a sideloaded APK before installing from Play, or updates will fail. Export a `.sbpbackup` first if you need to move the library.

**Support email:** z@blazedigitaldesign.com  
**Privacy:** https://github.com/GlorbyZ/setlist-ultra/blob/main/docs/privacy.md (also in-app Settings → Privacy).

Play Store V1 and GitHub APKs do **not** enable the Assist tab. Assist stays off unless `EXPO_PUBLIC_LAUNCH_AI=1` is set on purpose.

## Data safety inventory (Play Console)

Answer from this table. “Offline-first” is not “collects no data.”

| Data type | Collected? | Shared with third parties? | When |
|---|---|---|---|
| App activity (songs/sets you create) | Yes, on device | No, unless you enable cloud sync | Local SQLite |
| Files and docs (imports, backups, attachments) | Yes, on device | No | App private storage |
| Audio files you attach | Yes, on device | No | Not included in `.sbpbackup` |
| Photos / camera (scan) | Only if you pick an image | No | Optional |
| Account email / Google identity | Only if you sign in to cloud sync | Hosted backend (Supabase) when configured | Optional |
| Search queries (UG catalog) | Only if you search the catalog | Catalog proxy | Optional |
| AI prompts / chart snippets | No in Play V1 | — | Assist is off in the store binary |
| Location, contacts, ads ID, payment info | No | — | — |

Encryption in transit: HTTPS for optional network features. Encryption at rest: OS app storage; cloud follows the hosted provider when enabled.

Account deletion: in-app sign-out plus email to support (see privacy policy). No ads. Not a target-children app.

## EAS (owner machine)

From `apps/mobile`, after Expo/Apple/Play credentials exist. Pin CLI with `npx eas-cli@latest` (eas.json requires `>= 16.0.0`).

```bash
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile production   # AAB
npx eas-cli@latest build --platform ios --profile development      # registered iPhone + Metro
npx expo start --dev-client
```

GitHub `v*` tags still produce the sideload APK (`assembleRelease`). Play submission uses the production AAB, not that APK. EAS `development` profile is the Metro-connected iOS/Android client (`expo-dev-client`); keep GitHub APKs as store-style release binaries.

## Sideload vs Play

If the signing certificate of historical GitHub APKs does not match Play App Signing, users must uninstall the sideload build and restore from `.sbpbackup`. Settings shows this warning in every binary.
