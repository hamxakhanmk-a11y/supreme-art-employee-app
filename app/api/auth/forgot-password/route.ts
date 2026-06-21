import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, setupTokens } from "@/lib/schema";
import { generateToken } from "@/lib/auth";
import { isEmailConfigured, sendEmail, resetTemplate } from "@/lib/email";

export const dynamic = "force-dynamic";

function originFromReq(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const emailT = (email || "").trim().toLowerCase();
  const generic = { ok: true, emailConfigured: isEmailConfigured() };
  if (!emailT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailT)) return NextResponse.json(generic);
  if (!isEmailConfigured()) return NextResponse.json(generic);
  const rows = await db.select({ id: users.id, email: users.email, name: users.name, active: users.active })
    .from(users).where(sql`LOWER(${users.email}) = ${emailT}`).limit(1);
  if (!rows.length || !rows[0].active) return NextResponse.json(generic);
  const u = rows[0];
  const token = generateToken();
  const hours = 24;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db.insert(setupTokens).values({ token, userId: u.id, purpose: "reset", expiresAt });
  const setupUrl = `${originFromReq(req)}/set-password?token=${encodeURIComponent(token)}`;
  const tpl = resetTemplate({ inviteeName: u.name, setupUrl, hours });
  await sendEmail({ to: u.email, subject: "Reset your Supreme Art HR password", ...tpl });
  return NextResponse.json(generic);
}
