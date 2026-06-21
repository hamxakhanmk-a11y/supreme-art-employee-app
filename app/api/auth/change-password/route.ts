import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/schema";
import { COOKIE_NAME, getSession, hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) return NextResponse.json({ error: "Current and new password required" }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  const [u] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!u?.passwordHash) return NextResponse.json({ error: "Account is in an unexpected state" }, { status: 400 });
  const ok = await verifyPassword(currentPassword, u.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  const hash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));
  // Kick other sessions
  const store = await cookies();
  const cookieToken = store.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.token, cookieToken)));
  }
  return NextResponse.json({ ok: true });
}
