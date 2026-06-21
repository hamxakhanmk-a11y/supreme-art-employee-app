// Re-send / regenerate an invite or reset link for a user.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, setupTokens } from "@/lib/schema";
import { ADMIN_ROLES, generateToken, requireAuth } from "@/lib/auth";
import { inviteTemplate, isEmailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function originFromReq(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try { admin = await requireAuth(ADMIN_ROLES); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const token = generateToken();
  const hours = 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db.insert(setupTokens).values({ token, userId: u.id, purpose: "invite", expiresAt });
  const setupUrl = `${originFromReq(req)}/set-password?token=${encodeURIComponent(token)}`;

  let emailResult: any = { sent: false, reason: "not_configured" };
  if (isEmailConfigured()) {
    const tpl = inviteTemplate({ inviterName: admin.name, inviteeName: u.name, role: u.role, setupUrl, hours });
    emailResult = await sendEmail({ to: u.email, subject: "Supreme Art HR — set your password", ...tpl });
  }
  return NextResponse.json({ setupUrl, emailSent: !!emailResult.sent, emailReason: emailResult.reason });
}
