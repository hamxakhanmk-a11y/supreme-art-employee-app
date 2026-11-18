import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/schema";
import { ADMIN_ROLES, requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST — log this person out of every device now (Admin → Users → Log out). Their sign-ins are deleted; any
// page they have open notices on its next check (within seconds, see /api/auth/alive) and goes to the login.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try { admin = await requireAuth(ADMIN_ROLES); }
  catch (e) { const err = e as { message?: string; status?: number }; return NextResponse.json({ error: err.message || "Not authenticated" }, { status: err.status || 401 }); }
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (userId === admin.id) return NextResponse.json({ error: "Use Sign out to log yourself out." }, { status: 400 });
  const [target] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const ended = await db.delete(sessions).where(eq(sessions.userId, userId)).returning({ token: sessions.token });
  await logActivity({ user: admin, action: "user.logout", summary: `logged ${target.name || target.email} out of every device (${ended.length} sign-in${ended.length === 1 ? "" : "s"})` });
  return NextResponse.json({ ok: true, ended: ended.length });
}
