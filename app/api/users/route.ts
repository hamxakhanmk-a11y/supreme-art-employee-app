import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { ADMIN_ROLES, requireAuth } from "@/lib/auth";
import { isAssignableRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  let caller;
  try {
    caller = await requireAuth(ADMIN_ROLES);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 });
  }
  const rows = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
    active: users.active, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));

  // The Super Admin role is the owner’s alone to see. This endpoint is
  // superadmin-only today, so the mask is a no-op right now — but it keeps
  // the list safe the moment this route (or a future one built on the same
  // query) is ever opened to Admin/HR, without anyone having to remember to
  // add it then. A non-owner sees every other superadmin’s role as "admin";
  // the caller always sees their own role correctly.
  const visible = caller.role === "superadmin"
    ? rows
    : rows.map(r => (r.role === "superadmin" && r.id !== caller.id) ? { ...r, role: "admin" } : r);

  return NextResponse.json({ users: visible });
}

// Add an email to the allowlist. On next Google sign-in with that address the
// user is admitted with the assigned role. No passwords, no invite emails.
export async function POST(req: Request) {
  try {
    await requireAuth(ADMIN_ROLES);
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
  if (!role || !(await isAssignableRole(role))) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const existing = await db.select({ id: users.id }).from(users).where(sql`LOWER(${users.email}) = ${emailT}`).limit(1);
  if (existing.length) return NextResponse.json({ error: "That email is already on the list" }, { status: 409 });

  const [u] = await db.insert(users).values({
    email: emailT, name: nameT, role, active: true,
  }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  return NextResponse.json({ user: u });
}
