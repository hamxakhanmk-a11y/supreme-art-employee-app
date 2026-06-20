import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { hashPassword, createSession, setSessionCookie, countUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const total = await countUsers();
  if (total > 0) return NextResponse.json({ error: "Setup has already been completed" }, { status: 403 });
  const { name, email, password } = await req.json().catch(() => ({}));
  const nameT = (name || "").trim();
  const emailT = (email || "").trim();
  if (!nameT) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!emailT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailT)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const hash = await hashPassword(password);
  const [u] = await db.insert(users).values({
    email: emailT.toLowerCase(),
    name: nameT,
    role: "superadmin",
    passwordHash: hash,
    active: true,
  }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  const token = await createSession(u.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await setSessionCookie(token);
  return NextResponse.json({ user: u });
}
