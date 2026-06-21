import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  const rows = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  const u = rows[0];
  if (!u.active) return NextResponse.json({ error: "Account is disabled" }, { status: 401 });
  if (!u.passwordHash) return NextResponse.json({ error: "This account has not finished setup. Ask an admin for a fresh invite link." }, { status: 401 });
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  const token = await createSession(u.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await setSessionCookie(token);
  return NextResponse.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
}
