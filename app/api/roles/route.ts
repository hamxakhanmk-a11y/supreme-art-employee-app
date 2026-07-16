import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rolePermissions } from "@/lib/schema";
import { guardSuperAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  MODULES,
  ALL_MODULE_KEYS,
  EDITABLE_ROLES,
  loadAllPerms,
  invalidatePermsCache,
  ensureRolePermissionsTable,
  type ModuleKey,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  hr: "HR",
  ceo: "CEO",
  procurement: "Procurement",
};

export async function GET() {
  const guard = await guardSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const all = await loadAllPerms();
  const roles = EDITABLE_ROLES.map((role) => ({
    role,
    label: ROLE_LABEL[role] ?? role,
    modules: all[role]?.modules ?? [],
    canEdit: all[role]?.canEdit ?? false,
  }));
  return NextResponse.json({ modules: MODULES, roles });
}

export async function PUT(req: Request) {
  const guard = await guardSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => ({}));
  const role = String(body.role || "");
  if (!(EDITABLE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "That role can't be edited." }, { status: 400 });
  }
  if (!Array.isArray(body.modules)) {
    return NextResponse.json({ error: "modules must be an array" }, { status: 400 });
  }
  const modules = (body.modules as unknown[])
    .map((m) => String(m))
    .filter((m): m is ModuleKey => (ALL_MODULE_KEYS as string[]).includes(m));
  const canEdit = body.canEdit !== false; // default to editable unless explicitly false

  const modulesStr = modules.join(",");
  await ensureRolePermissionsTable();
  await db
    .insert(rolePermissions)
    .values({ role, modules: modulesStr, canEdit, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: rolePermissions.role,
      set: { modules: modulesStr, canEdit, updatedAt: new Date() },
    });

  invalidatePermsCache();

  await logActivity({
    user: guard,
    action: "roles.update",
    summary: `Updated ${ROLE_LABEL[role] ?? role} permissions — ${
      canEdit ? "can edit" : "view-only"
    }, modules: ${modules.length ? modules.join(", ") : "none"}`,
  });

  return NextResponse.json({ ok: true });
}
