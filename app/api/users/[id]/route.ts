import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { ADMIN_ROLES, requireAuth } from "@/lib/auth";
import { isAssignableRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Count other active superadmins (excluding the given user id). Used to make
// sure we never end up with zero active superadmins in the system.
async function otherActiveSuperAdminCount(excludeId: number): Promise<number> {
  const [row] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(users)
    .where(and(eq(users.role, "superadmin"), eq(users.active, true), ne(users.id, excludeId)));
  return Number(row?.n || 0);
}

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
    if (!(await isAssignableRole(body.role))) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    updates.role = body.role;
  }
  if (typeof body.active === "boolean") updates.active = body.active;
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const [target] = await db.select({ role: users.role, active: users.active }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Self-protection: can't deactivate yourself.
  if (userId === admin.id && updates.active === false) {
    return NextResponse.json({ error: "You can't deactivate yourself" }, { status: 400 });
  }

  // System invariant: at least one active superadmin must remain.
  if (target.role === "superadmin" && target.active) {
    const demoting = updates.role && updates.role !== "superadmin";
    const deactivating = updates.active === false;
    if (demoting || deactivating) {
      const others = await otherActiveSuperAdminCount(userId);
      if (others === 0) {
        return NextResponse.json({ error: "At least one active Super Admin must remain." }, { status: 400 });
      }
    }
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
  const [target] = await db.select({ role: users.role, active: users.active }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "superadmin" && target.active) {
    const others = await otherActiveSuperAdminCount(userId);
    if (others === 0) {
      return NextResponse.json({ error: "At least one active Super Admin must remain." }, { status: 400 });
    }
  }
  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
