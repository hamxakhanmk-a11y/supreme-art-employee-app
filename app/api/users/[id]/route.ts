import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { ADMIN_ROLES, ROLES, requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try { admin = await requireAuth(ADMIN_ROLES); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const updates: any = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.role === "string") {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    updates.role = body.role;
  }
  if (typeof body.active === "boolean") updates.active = body.active;
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  // Don't let admin lock self out of admin role / deactivate self
  if (userId === admin.id) {
    if (updates.role && updates.role !== "admin") return NextResponse.json({ error: "You can't demote yourself" }, { status: 400 });
    if (updates.active === false) return NextResponse.json({ error: "You can't deactivate yourself" }, { status: 400 });
  }

  updates.updatedAt = new Date();
  await db.update(users).set(updates).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try { admin = await requireAuth(ADMIN_ROLES); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (userId === admin.id) return NextResponse.json({ error: "You can't delete yourself" }, { status: 400 });
  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
