# Google Sign-In setup

The portal now signs in with Google. Access is an **allowlist**: only emails added
under **Users** (superadmin only) can get in. Roles (superadmin / admin / hr / ceo)
are unchanged and still govern who can edit vs view.

## 1. Create the OAuth credentials (Google Cloud Console)

1. https://console.cloud.google.com → create or pick a project.
2. **APIs & Services → OAuth consent screen** → User type **External** →
   fill app name + support email. Add your own Google account under **Test users**
   (or Publish the app). Scopes: `email` and `profile` (the defaults) are enough.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   Application type **Web application**.
4. **Authorized redirect URIs** — add one per environment:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://YOUR-PROD-DOMAIN/api/auth/google/callback`
5. Copy the **Client ID** and **Client Secret**.

## 2. Environment variables

Set these wherever the app runs (Vercel → Project → Settings → Environment Variables,
and `.env.local` for local dev):

| Variable                | Value                                             |
| ----------------------- | ------------------------------------------------- |
| `GOOGLE_CLIENT_ID`      | from step 1                                        |
| `GOOGLE_CLIENT_SECRET`  | from step 1                                        |
| `BOOTSTRAP_OWNER_EMAIL` | your Google email — auto-admitted as superadmin on first sign-in |

`BOOTSTRAP_OWNER_EMAIL` guarantees the owner is never locked out: the first time that
address signs in, it's created as a superadmin even if it isn't on the list yet. You can
remove the variable after your first successful login (optional).

## 3. First login

1. Redeploy so the env vars take effect.
2. Go to `/login` → **Sign in with Google** → pick your account.
3. You land in as superadmin. Open **Users** and add everyone else's Google email with
   the right role. They can then sign in themselves.

## Notes

- Sign-out and sessions work exactly as before (30-day `sae_session` cookie).
- No passwords are stored or used anymore. The old password/invite/reset flows were removed.
