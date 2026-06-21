import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, setupTokens } from "@/lib/schema";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ valid: false, error: "Token required" }, { status: 400 });
  const rows = await db
    .select({
      purpose: setupTokens.purpose,
      expiresAt: setupTokens.expiresAt,
      usedAt: setupTokens.usedAt,
      email: users.email,
      name: users.name,
    })
    .from(setupTokens)
    .innerJoin(users, eq(users.id, setupTokens.userId))
    .where(eq(setupTokens.token, token))
    .limit(1);
  if (!rows.length) return NextResponse.json({ valid: false, error: "Invalid link" }, { status: 404 });
  const r = rows[0];
  if (r.usedAt) return NextResponse.json({ valid: false, error: "This link has already been used" }, { status: 410 });
  if (new Date(r.expiresAt) < new Date()) return NextResponse.json({ valid: false, error: "This link has expired" }, { status: 410 });
  return NextResponse.json({ valid: true, purpose: r.purpose, name: r.name, email: r.email });
}

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  const rows = await db.select().from(setupTokens).where(eq(setupTokens.token, token)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const r = rows[0];
  if (r.usedAt) return NextResponse.json({ error: "This link has already been used" }, { status: 410 });
  if (new Date(r.expiresAt) < new Date()) return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  const hash = await hashPassword(password);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, r.userId));
  await db.update(setupTokens).set({ usedAt: new Date() }).where(eq(setupTokens.token, token));
  // Burn other unused tokens for this user
  await db.update(setupTokens).set({ usedAt: new Date() })
    .where(and(eq(setupTokens.userId, r.userId), isNull(setupTokens.usedAt)));
  const sessionToken = await createSession(r.userId);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, r.userId));
  await setSessionCookie(sessionToken);
  const [u] = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users).where(eq(users.id, r.userId)).limit(1);
  return NextResponse.json({ user: u });
}
