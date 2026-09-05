# Hosted backend (Supabase)

Setlist Ultra stores **one chart blob per unique fingerprint** (`content_hash` = MD5 of ChordPro, same as Songbook Pro `hash`). Personal and org libraries point at that catalog row.

This is **not** a public Ultimate Guitar dump. Only charts someone on *this* instance already imported are reused.

## Setup

1. Create a Supabase project.
2. Run [`supabase.sql`](./supabase.sql) in the SQL editor.
3. Copy the project URL and anon key into `apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Enable Email auth (and later Apple Sign In on iOS if you add other social providers).

Without these vars the app stays **local-only** (SQLite). Sign-in screens still explain how to connect.

## Storage win

`charts` is unique on `content_hash` and on `(source_provider, source_external_id)`. Importing the same UG tab or SBP chart in another account attaches a new `library_items` row — it does not store a second copy of the ChordPro.
