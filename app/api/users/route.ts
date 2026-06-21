import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, setupTokens } from "@/lib/schema";
import { ADMIN_ROLES, AuthError, ROLES, generateToken, requireAuth } from "@/lib/auth";
import { isEmailConfigured, sendEmail, inviteTemplate } from "@/lib/email";

export const dynamic = "force-dynamic";

function originFromReq(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET() {
  try {
    await requireAuth(ADMIN_ROLES);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 });
  }
  const rows = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
    active: users.active, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
    hasPassword: sql<boolean>`(${users.passwordHash} IS NOT NULL)`,
  }).from(users).orderBy(desc(users.createdAt));
  return NextResponse.json({ users: rows, emailConfigured: isEmailConfigured() });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAuth(ADMIN_ROLES);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 });
  }
  const { name, email, role } = await req.json().catch(() => ({}));
  const nameT = (name || "").trim();
  const emailT = (email || "").trim().toLowerCase();
  if (!nameT) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!emailT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailT)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (role === "superadmin") return NextResponse.json({ error: "Super Admin role cannot be assigned via invite" }, { status: 400 });

  // Check if user already exists
  const existing = await db.select().from(users).where(sql`LOWER(${users.email}) = ${emailT}`).limit(1);
  if (existing.length) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });

  const [u] = await db.insert(users).values({
    email: emailT, name: nameT, role, active: true,
  }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  // Make invite token (24h)
  const token = generateToken();
  const hours = 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db.insert(setupTokens).values({ token, userId: u.id, purpose: "invite", expiresAt });
  const setupUrl = `${originFromReq(req)}/set-password?token=${encodeURIComponent(token)}`;

  let emailResult: any = { sent: false, reason: "not_configured" };
  if (isEmailConfigured()) {
    const tpl = inviteTemplate({ inviterName: admin.name, inviteeName: u.name, role: u.role, setupUrl, hours });
    emailResult = await sendEmail({ to: u.email, subject: "You've been invited to Supreme Art HR", ...tpl });
  }

  return NextResponse.json({ user: u, setupUrl, emailSent: !!emailResult.sent, emailReason: emailResult.reason });
}
