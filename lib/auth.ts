import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql, and, gt } from "drizzle-orm";
import { db } from "./db";
import { users, sessions } from "./schema";

export const COOKIE_NAME = "sae_session";
export const SESSION_DAYS = 30;

export type Role = "superadmin" | "admin" | "hr" | "ceo";
export const ROLES: Role[] = ["superadmin", "admin", "hr", "ceo"];
// Roles that can perform any write (create/update/delete) action in the app.
// CEO is view-only.
export const WRITE_ROLES: Role[] = ["superadmin", "admin", "hr"];
// Roles that can manage / invite users.
export const USER_MGMT_ROLES: Role[] = ["superadmin"];
// Backwards-compat alias (older code may import ADMIN_ROLES).
export const ADMIN_ROLES: Role[] = USER_MGMT_ROLES;

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: number) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  return token;
}

export async function destroySession(token: string) {
  try { await db.delete(sessions).where(eq(sessions.token, token)); } catch {}
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  if (!r.active) return null;
  return { id: r.id, email: r.email, name: r.name, role: r.role as Role };
}

export async function requireAuth(allowedRoles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AuthError(401, "Not authenticated");
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new AuthError(403, "You don't have permission to perform this action");
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Returns the user, or a NextResponse you should return immediately.
// Usage: const guard = await guardWrite(); if (guard instanceof NextResponse) return guard;
export async function guardAuth(allowedRoles?: Role[]): Promise<SessionUser | NextResponse> {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "You don't have permission to perform this action" }, { status: 403 });
  }
  return user;
}
export const guardWrite = () => guardAuth(WRITE_ROLES);
export const guardSuperAdmin = () => guardAuth(USER_MGMT_ROLES);

export async function countUsers(): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  return rows[0]?.c ?? 0;
}
