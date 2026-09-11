# Privacy policy — Setlist Ultra

Contact: **z@blazedigitaldesign.com**  
App: Setlist Ultra (`com.setlistultra.app`)  
Last updated: 11 September 2026

This policy describes how the Android/iOS/web app handles data for the current Play Store V1 freeze. Public copy for store listings: https://github.com/GlorbyZ/setlist-ultra/blob/main/docs/privacy.md

## What the app stores on the device

By default, songs, setlists, folders, display preferences, and import checkpoints live in a local SQLite database on the device. Imported files and attached audio/PDFs are stored in the app’s private files. You can use the library, editor, and Live charts without creating an account.

Local `.sbpbackup` export contains songs and sets. **Attached audio and PDFs are not inside the backup.** Restore imports the archive back into the local library.

Uninstalling the app removes the local library on that device.

## Optional network features

These run only when configured and when you use them:

| Feature | What leaves the device |
|---|---|
| Ultimate Guitar search/import | Search text and selected tab URLs go to the catalog proxy (`ug.bigzay.com` when that URL is configured). |
| Cloud sync / Google or email sign-in | Account credentials and library records go to the hosted backend (Supabase) when those URLs and keys are present in the build. |
| Camera / photo scan | Images stay on device. Scan in this Play freeze is not OCR and does not send images to an AI provider. |
| Share / file import | Content is read into the local library. Oversized or empty files are rejected. |

The Google Play V1 binary does **not** include an in-app AI assistant. Core songbook functions keep working if optional network services are off or unreachable.

## What we do not collect by default

This app does not ship ads, crash-analytics, or marketing SDKs. We do not log full lyrics, private notes, images, or credentials by default.

## Accounts and deletion

If cloud sync is enabled and you create an account:

1. Use **Sign out** in Settings to end the session on this device.
2. Use **Delete cloud account** in Settings, which signs you out and opens an email to **z@blazedigitaldesign.com**.
3. We will delete hosted account data associated with that email, subject to backups and any legal retention that still applies.

Local songs remain on the device until you delete them or uninstall.

## Children

Setlist Ultra is intended for general audiences, not specifically for children. Do not use the app to store other people’s personal data without a lawful basis.

## Changes

We will update this document when enabled SDKs, sync, or retention behavior changes. The in-app Privacy screen summarizes the same points.

## Contact

z@blazedigitaldesign.com
