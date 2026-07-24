// Per-role, per-module access control.
//
// Each role has (a) a set of modules it may open, and (b) a single `canEdit`
// switch — when false the role is view-only everywhere (the CEO case).
// superadmin always has full access and is never read from the table.
//
// This file imports only db + schema (never lib/auth) to avoid an import cycle,
// since lib/auth's guardWrite() calls into here.
import { sql } from "drizzle-orm";
import { db } from "./db";
import { rolePermissions } from "./schema";

export type ModuleKey =
  | "employees"
  | "attendance"
  | "forms"
  | "reports"
  | "salary"
  | "kpi"
  | "purchase"
  | "station"
  | "demand"
  | "po"
  | "grn"
  | "inspection"
  | "store";

export const MODULES: { key: ModuleKey; label: string; hint: string }[] = [
  { key: "employees",  label: "Employees",   hint: "Add / edit employee records & documents" },
  { key: "attendance", label: "Attendance",  hint: "Mark attendance, close days, off-days" },
  { key: "forms",      label: "Forms & Leave", hint: "Leave / half-day forms & approvals" },
  { key: "reports",    label: "Reports",     hint: "Attendance register, leave, salary & activity reports" },
  { key: "salary",     label: "Salary",      hint: "Generate & view salary slips" },
  { key: "kpi",        label: "KPI",         hint: "Assign templates & enter monthly KPI values" },
  { key: "purchase",   label: "Purchase",    hint: "Purchase requisition register" },
  { key: "station",    label: "Station",     hint: "Station terminal & hourly-leave report" },
  { key: "demand",     label: "Raise Demand", hint: "Procurement — create material demand forms" },
  { key: "po",         label: "Create PO",    hint: "Procurement — create purchase orders" },
  { key: "grn",        label: "Make GRN",     hint: "Procurement — create goods-receiving reports" },
  { key: "inspection", label: "Inspection",   hint: "Procurement — incoming material inspection (QC)" },
  { key: "store",      label: "Parts Store",  hint: "Spare-parts inventory: categories, parts, in/out transactions" },
];

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);

export interface RolePerm {
  modules: ModuleKey[];
  canEdit: boolean;
}

// Editable roles shown in the permissions UI (superadmin is fixed/full).
export const EDITABLE_ROLES = ["admin", "hr", "ceo", "procurement"] as const;

// Out-of-the-box defaults preserve the app's previous behaviour exactly:
// admin & hr can do everything; ceo sees everything but can't edit.
// procurement starts narrow (purchase only) — tune it in Role Permissions.
export const DEFAULT_PERMS: Record<string, RolePerm> = {
  superadmin:  { modules: [...ALL_MODULE_KEYS], canEdit: true },
  admin:       { modules: [...ALL_MODULE_KEYS], canEdit: true },
  hr:          { modules: [...ALL_MODULE_KEYS], canEdit: true },
  ceo:         { modules: [...ALL_MODULE_KEYS], canEdit: false },
  procurement: { modules: ["purchase", "po"], canEdit: true },
};

function fullAccess(): RolePerm {
  return { modules: [...ALL_MODULE_KEYS], canEdit: true };
}

function sanitizeModules(raw: string | null | undefined): ModuleKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModuleKey => (ALL_MODULE_KEYS as string[]).includes(s));
}

// Short in-memory cache so we don't hit the DB on every guarded request.
let cache: { at: number; data: Record<string, RolePerm> } | null = null;
const TTL_MS = 15_000;

export function invalidatePermsCache() {
  cache = null;
}

export async function loadAllPerms(): Promise<Record<string, RolePerm>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  // Seed every editable role from its default, then let stored rows override.
  const data: Record<string, RolePerm> = {};
  for (const role of EDITABLE_ROLES) {
    const d = DEFAULT_PERMS[role];
    data[role] = { modules: [...d.modules], canEdit: d.canEdit };
  }

  try {
    const rows = await db.select().from(rolePermissions);
    for (const r of rows) {
      if (r.role === "superadmin") continue; // always full, ignore any stored row
      data[r.role] = { modules: sanitizeModules(r.modules), canEdit: r.canEdit };
    }
  } catch {
    // Table missing (not migrated yet) → fall back to defaults, never lock out.
  }

  data.superadmin = fullAccess(); // invariant: owner is always full-access
  cache = { at: Date.now(), data };
  return data;
}

export async function getPerm(role: string): Promise<RolePerm> {
  if (role === "superadmin") return fullAccess();
  const all = await loadAllPerms();
  return all[role] ?? { modules: [], canEdit: false };
}

// Idempotently create the table. Reads tolerate its absence (defaults), but the
// first save needs it — so we create it here rather than requiring a manual
// migration against production (whose URL isn't available locally).
let tableEnsured = false;
export async function ensureRolePermissionsTable() {
  if (tableEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role varchar(20) PRIMARY KEY,
      modules text NOT NULL DEFAULT '',
      can_edit boolean NOT NULL DEFAULT true,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  tableEnsured = true;
}

export async function roleCanAccess(role: string, moduleKey: ModuleKey): Promise<boolean> {
  if (role === "superadmin") return true;
  const p = await getPerm(role);
  return p.modules.includes(moduleKey);
}
