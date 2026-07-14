// Google OAuth (Authorization Code flow) — no external deps, uses Google's
// public HTTP endpoints. Credentials come from env:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Optional: BOOTSTRAP_OWNER_EMAIL — if set, that email is auto-provisioned as
// a superadmin on first sign-in (so the owner is never locked out).

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

// Short-lived cookie holding the CSRF state + post-login redirect target.
export const OAUTH_STATE_COOKIE = "sae_oauth_state";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function bootstrapOwnerEmail(): string | null {
  const e = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  return e || null;
}

// The public origin of the current request. Behind Vercel/proxies the real
// host/proto arrive in x-forwarded-* headers; fall back to the Host header.
export function originFromRequest(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  return `${proto}://${host}`;
}

export function redirectUri(req: Request): string {
  return `${originFromRequest(req)}/api/auth/google/callback`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

// Exchange an authorization code for tokens, then fetch the user's profile.
export async function exchangeCodeForProfile(code: string, redirect: string): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text().catch(() => "");
    throw new Error(`Token exchange failed (${tokenRes.status}): ${t.slice(0, 200)}`);
  }
  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token as string | undefined;
  if (!accessToken) throw new Error("No access_token in Google response");

  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!infoRes.ok) {
    const t = await infoRes.text().catch(() => "");
    throw new Error(`Userinfo failed (${infoRes.status}): ${t.slice(0, 200)}`);
  }
  const info = await infoRes.json();
  return {
    sub: String(info.sub || ""),
    email: String(info.email || "").trim().toLowerCase(),
    emailVerified: info.email_verified === true || info.email_verified === "true",
    name: String(info.name || info.email || "").trim(),
    picture: info.picture ? String(info.picture) : undefined,
  };
}
