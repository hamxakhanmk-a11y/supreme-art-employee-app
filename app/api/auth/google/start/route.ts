import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { GOOGLE_AUTH_URL, OAUTH_STATE_COOKIE, googleConfigured, redirectUri } from "@/lib/google";

export const dynamic = "force-dynamic";

// Only allow same-origin, path-only redirect targets (defends against open redirect).
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));

  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=not_configured", req.url));
  }

  // CSRF state; we tuck `next` alongside it so the callback can restore it.
  const state = crypto.randomBytes(16).toString("hex");
  const statePayload = `${state}.${Buffer.from(next).toString("base64url")}`;

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  authUrl.searchParams.set("redirect_uri", redirectUri(req));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, statePayload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    path: "/",
    maxAge: 600, // 10 minutes to complete the round-trip
  });
  return res;
}
