# Setlist Ultra � Supabase Auth setup

App scheme: `setlistultra` (see `apps/mobile/app.json`).

OAuth redirect used by the app (dev client / standalone):

```
setlistultra://auth/callback
```

`makeRedirectUri({ scheme: 'setlistultra', path: 'auth/callback' })` produces that URL.
In **Expo Go**, the redirect may look like `exp://<lan-ip>:8081/--/auth/callback` � check Settings ? Sync (OAuth redirect) and allow-list that exact value too while developing in Expo Go.

## Supabase Dashboard

Project: **Setlist Ultra** (`mqcjrnmhmceubdgoxxlf`)

1. **Authentication ? URL Configuration ? Redirect URLs** � add:
   - `setlistultra://auth/callback`
   - (Expo Go, if used) the `exp://�/--/auth/callback` value shown in Settings
   - Optional web: `http://localhost:8081` / your web origin if you test auth on web

2. **Authentication ? Providers ? Google** � enable and paste:
   - **Client ID** = same as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env`
   - **Client Secret** from Google Cloud (Web application OAuth client)

3. **Authentication ? Providers ? Email** � enable (already typical default).

Dashboard deep links:

- Auth URL config: https://supabase.com/dashboard/project/mqcjrnmhmceubdgoxxlf/auth/url-configuration
- Providers: https://supabase.com/dashboard/project/mqcjrnmhmceubdgoxxlf/auth/providers

## Google Cloud Console

OAuth client type: **Web application** (this is what Supabase Google provider uses).

**Authorized redirect URIs** (Google ? this app Supabase project):

```
https://mqcjrnmhmceubdgoxxlf.supabase.co/auth/v1/callback
```

Do **not** put `setlistultra://�` in Google Cloud � only in Supabase redirect allow-list. Google redirects to Supabase; Supabase then redirects to the app.

### Android native client (optional / missing)

`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is currently empty. The in-app **Continue with Google** flow uses **Supabase OAuth + WebBrowser + `setlistultra://` redirect** and the **Web** client ID, so it works without an Android client ID.

Add an Android OAuth client later if you want native ID-token sign-in or Google Drive via `expo-auth-session/providers/google`.

## App env

`apps/mobile/.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (optional)
- `EXPO_PUBLIC_UG_PROXY_URL=https://ug.bigzay.com`

Restart Metro after changing `.env` so Expo picks up new public vars.
