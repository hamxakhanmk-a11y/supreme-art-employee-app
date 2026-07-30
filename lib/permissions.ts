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
  // reports — legacy master key (auto-expands into every reports.* below) plus
  // fine-grained per-report keys so a role can be granted just one section.
  | "reports"
  | "reports.attendance"
  | "reports.leaves"
  | "reports.halfday"
  | "reports.salary"
  | "reports.procurement"
  | "reports.station"
  | "reports.activity"
  | "salary"
  | "kpi"
  // purchase — legacy master key (auto-expands into every purchase.* below)
  // plus per-action keys so raising, editing and HR-approving can be split.
  | "purchase"
  | "purchase.raise"
  | "purchase.edit"
  | "purchase.delete"
  | "purchase.hr-approve"
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
  // Reports — tick the individual reports below rather than the umbrella.
  { key: "reports.attendance",  label: "Report · Attendance",  hint: "Attendance register + Excel export" },
  { key: "reports.leaves",      label: "Report · Leaves",      hint: "Leave history — filters & export" },
  { key: "reports.halfday",     label: "Report · Half-Day",    hint: "Half-day history — filters & export" },
  { key: "reports.salary",      label: "Report · Salary",      hint: "Salary records — view & reprint slips" },
  { key: "reports.procurement", label: "Report · Procurement", hint: "Demand / PO / GRR / Inspection register" },
  { key: "reports.station",     label: "Report · Station",     hint: "Hourly-leave register from Station" },
  { key: "reports.activity",    label: "Report · Activity Log", hint: "Audit trail of who did what" },
  { key: "salary",     label: "Salary",      hint: "Generate & view salary slips" },
  { key: "kpi",        label: "KPI",         hint: "Assign templates & enter monthly KPI values" },
  // Purchase — tick the individual actions below rather than the umbrella.
  { key: "purchase.raise",      label: "Purchase · Raise PR",    hint: "Create a new purchase requisition" },
  { key: "purchase.edit",       label: "Purchase · Edit",        hint: "Edit an existing PR — value, remarks, received, HOD approval" },
  { key: "purchase.delete",     label: "Purchase · Delete",      hint: "Delete a purchase requisition" },
  { key: "purchase.hr-approve", label: "Purchase · HR Approval", hint: "HR-approve or HR-reject a raised PR" },
  { key: "station",    label: "Station",     hint: "Station terminal & hourly-leave report" },
  { key: "demand",     label: "Raise Demand", hint: "Procurement — create material demand forms" },
  { key: "po",         label: "Create PO",    hint: "Procurement — create purchase orders" },
  { key: "grn",        label: "Make GRN",     hint: "Procurement — create goods-receiving reports" },
  { key: "inspection", label: "Inspection",   hint: "Procurement — incoming material inspection (QC)" },
  { key: "store",      label: "Parts Store",  hint: "Spare-parts inventory: categories, parts, in/out transactions" },
];

// Legacy umbrella keys expand into their fine-grained members at load time so
// existing roles keep working the moment we introduce the split. A role stored
// with "reports" gets treated as if it also had every "reports.*" key, and the
// Role Permissions UI shows them all ticked; the umbrella key stays in the
// stored list until the owner unticks it explicitly.
const MASTER_EXPANSION: Record<string, ModuleKey[]> = {
  reports: [
    "reports.attendance", "reports.leaves", "reports.halfday", "reports.salary",
    "reports.procurement", "reports.station", "reports.activity",
  ],
  purchase: ["purchase.raise", "purchase.edit", "purchase.delete", "purchase.hr-approve"],
};

function expandMasters(modules: ModuleKey[]): ModuleKey[] {
  const out = new Set<ModuleKey>(modules);
  for (const m of modules) {
    const kids = MASTER_EXPANSION[m as string];
    if (kids) for (const k of kids) out.add(k);
  }
  return [...out];
}

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);

export interface RolePerm {
  modules: ModuleKey[];
  canEdit: boolean;
}

// Editable roles shown in the permissions UI (superadmin is fixed/full).
export const EDITABLE_ROLES = ["admin", "hr", "ceo", "procurement", "engineer", "finance", "design", "accounts", "other"] as const;

// Out-of-the-box defaults preserve the app's previous behaviour exactly:
// admin & hr can do everything; ceo sees everything but can't edit.
// procurement and engineer start narrow — tune them in Role Permissions.
export const DEFAULT_PERMS: Record<string, RolePerm> = {
  superadmin:  { modules: [...ALL_MODULE_KEYS], canEdit: true },
  admin:       { modules: [...ALL_MODULE_KEYS], canEdit: true },
  hr:          { modules: [...ALL_MODULE_KEYS], canEdit: true },
  ceo:         { modules: [...ALL_MODULE_KEYS], canEdit: false },
  procurement: { modules: ["purchase", "po"], canEdit: true },
  engineer:    { modules: ["purchase"], canEdit: true },
  // Finance starts on salary + its report plus the purchase register — tune it
  // in Role Permissions.
  finance:     { modules: ["salary", "reports.salary", "purchase"], canEdit: true },
  // Design starts blank — tune it in Role Permissions.
  design:      { modules: [], canEdit: true },
  // Accounts starts blank — tune it in Role Permissions.
  accounts:    { modules: [], canEdit: true },
  // A blank-slate role — no access until the owner grants modules in the UI.
  other:       { modules: [], canEdit: true },
};

function fullAccess(): RolePerm {
  return { modules: [...ALL_MODULE_KEYS], canEdit: true };
}

// Anything we're prepared to accept from a stored row. That's the catalog keys
// plus the legacy umbrella keys ("reports", "purchase") which no longer show
// as tick-boxes but still round-trip through expansion.
const ACCEPTED_STORED_KEYS = new Set<string>([
  ...(ALL_MODULE_KEYS as string[]),
  ...Object.keys(MASTER_EXPANSION),
]);
function sanitizeModules(raw: string | null | undefined): ModuleKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModuleKey => ACCEPTED_STORED_KEYS.has(s));
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

  // Expand legacy umbrella keys ("reports", "purchase") so every downstream
  // check and the Role Permissions UI sees the fine-grained set.
  for (const role of Object.keys(data)) {
    data[role].modules = expandMasters(data[role].modules);
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
