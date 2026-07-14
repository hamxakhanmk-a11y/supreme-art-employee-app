import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { COOKIE_NAME, SESSION_DAYS, createSession, countUsers } from "@/lib/auth";
import {
  OAUTH_STATE_COOKIE,
  bootstrapOwnerEmail,
  exchangeCodeForProfile,
  googleConfigured,
  redirectUri,
} from "@/lib/google";

export const dynamic = "force-dynamic";

function loginRedirect(req: NextRequest, error: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");

  if (oauthErr) return loginRedirect(req, "denied");
  if (!googleConfigured()) return loginRedirect(req, "not_configured");
  if (!code || !returnedState) return loginRedirect(req, "invalid");

  // Verify CSRF state and recover the post-login `next` target.
  const cookieVal = req.cookies.get(OAUTH_STATE_COOKIE)?.value || "";
  const [savedState, nextB64] = cookieVal.split(".");
  if (!savedState || savedState !== returnedState) return loginRedirect(req, "state");
  let next = "/";
  try {
    const decoded = Buffer.from(nextB64 || "", "base64url").toString();
    if (decoded.startsWith("/") && !decoded.startsWith("//")) next = decoded;
  } catch { /* keep default */ }

  // Exchange the code and read the verified Google profile.
  let profile;
  try {
    profile = await exchangeCodeForProfile(code, redirectUri(req));
  } catch {
    return loginRedirect(req, "exchange");
  }
  if (!profile.email || !profile.emailVerified) return loginRedirect(req, "unverified");

  // Match against the allowlist (case-insensitive).
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role, active: users.active })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${profile.email}`)
    .limit(1);

  let userId: number;
  if (rows.length) {
    const u = rows[0];
    if (!u.active) return loginRedirect(req, "disabled");
    userId = u.id;
    // Keep the display name in sync with Google, refresh last login.
    await db.update(users)
      .set({ name: profile.name || u.name, lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, u.id));
  } else {
    // Not on the allowlist. Allow the very first user, or a designated owner
    // email, to bootstrap themselves as superadmin — otherwise deny.
    const isFirstEver = (await countUsers()) === 0;
    const isOwner = bootstrapOwnerEmail() === profile.email;
    if (!isFirstEver && !isOwner) return loginRedirect(req, "not_allowed");
    const [created] = await db.insert(users).values({
      email: profile.email,
      name: profile.name || profile.email,
      role: "superadmin",
      active: true,
      lastLoginAt: new Date(),
    }).returning({ id: users.id });
    userId = created.id;
  }

  const token = await createSession(userId);
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
