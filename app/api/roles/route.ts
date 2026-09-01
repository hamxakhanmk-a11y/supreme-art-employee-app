import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rolePermissions, users } from "@/lib/schema";
import { guardSuperAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  VISIBLE_MODULES,
  ALL_MODULE_KEYS,
  loadRoles,
  loadAllPerms,
  invalidatePermsCache,
  ensureRolePermissionsTable,
  createCustomRole,
  deleteCustomRole,
  type ModuleKey,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const isHexColor = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);

export async function GET() {
  const guard = await guardSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const [all, metas] = await Promise.all([loadAllPerms(), loadRoles()]);
  const roles = metas.filter(m => m.editable).map(m => ({
    role: m.key,
    label: m.label,
    color: m.color,
    builtin: m.builtin,
    modules: all[m.key]?.modules ?? [],
    editModules: all[m.key]?.editModules ?? [],
    canEdit: all[m.key]?.canEdit ?? true,
  }));
  // Every assignable role (incl. superadmin) for user-role pickers.
  const allRoles = metas.map(m => ({ key: m.key, label: m.label, color: m.color, builtin: m.builtin }));
  return NextResponse.json({ modules: VISIBLE_MODULES, roles, allRoles });
}

// Create a new custom role.
export async function POST(req: Request) {
  const guard = await guardSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => ({}));
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Role name is required." }, { status: 400 });
  if (label.length > 80) return NextResponse.json({ error: "Role name is too long." }, { status: 400 });
  const color = isHexColor(body.color) ? body.color : "#64748B";

  const created = await createCustomRole(label, color);
  await logActivity({ user: guard, action: "roles.create", summary: `Created role "${created.label}" (${created.key})` });
  return NextResponse.json({ role: created });
}

// Delete a custom role (built-ins can't be deleted; must have no users on it).
export async function DELETE(req: Request) {
  const guard = await guardSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => ({}));
  const role = String(body.role || "");
  const metas = await loadRoles();
  const target = metas.find(m => m.key === role);
  if (!target) return NextResponse.json({ error: "No such role." }, { status: 404 });
  if (target.builtin) return NextResponse.json({ error: "Built-in roles can't be deleted." }, { status: 400 });

  const held = await db.select({ id: users.id }).from(users).where(eq(users.role, role)).limit(1);
  if (held.length) {
    return NextResponse.json({ error: "Reassign the users on this role before deleting it." }, { status: 409 });
  }

  await deleteCustomRole(role);
  await logActivity({ user: guard, action: "roles.delete", summary: `Deleted role "${target.label}" (${role})` });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const guard = await guardSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => ({}));
  const role = String(body.role || "");
  const metas = await loadRoles();
  const target = metas.find(m => m.key === role && m.editable);
  if (!target) {
    return NextResponse.json({ error: "That role can't be edited." }, { status: 400 });
  }
  if (!Array.isArray(body.modules)) {
    return NextResponse.json({ error: "modules must be an array" }, { status: 400 });
  }
  const modules = (body.modules as unknown[])
    .map((m) => String(m))
    .filter((m): m is ModuleKey => (ALL_MODULE_KEYS as string[]).includes(m));
  const accessSet = new Set<string>(modules);
  // Edit set: valid module keys that are also in the access set.
  const editModules = (Array.isArray(body.editModules) ? body.editModules as unknown[] : [])
    .map((m) => String(m))
    .filter((m): m is ModuleKey => (ALL_MODULE_KEYS as string[]).includes(m) && accessSet.has(m));
  const canEdit = editModules.length > 0;

  const modulesStr = modules.join(",");
  const editModulesStr = editModules.join(",");
  await ensureRolePermissionsTable();
  await db
    .insert(rolePermissions)
    .values({ role, modules: modulesStr, editModules: editModulesStr, canEdit, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: rolePermissions.role,
      set: { modules: modulesStr, editModules: editModulesStr, canEdit, updatedAt: new Date() },
    });

  invalidatePermsCache();

  await logActivity({
    user: guard,
    action: "roles.update",
    summary: `Updated ${target.label} permissions — view: ${modules.length}, edit: ${editModules.length}`,
  });

  return NextResponse.json({ ok: true });
}
