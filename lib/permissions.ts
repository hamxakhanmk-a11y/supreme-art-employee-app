// Per-role, per-module access control.
//
// Each role has (a) a set of modules it may open, and (b) a single `canEdit`
// switch — when false the role is view-only everywhere (the CEO case).
// superadmin always has full access and is never read from the table.
//
// This file imports only db + schema (never lib/auth) to avoid an import cycle,
// since lib/auth's guardWrite() calls into here.
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { rolePermissions, customRoles } from "./schema";

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
  | "purchase.receive"
  | "station"
  | "demand"
  | "po"
  | "grn"
  | "inspection"
  | "store"
  | "capa";

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
  { key: "purchase.edit",       label: "Purchase · Edit",        hint: "Edit an existing PR — value, remarks, HOD approval" },
  { key: "purchase.receive",    label: "Purchase · Receive",     hint: "Mark material received (Admin)" },
  { key: "purchase.delete",     label: "Purchase · Delete",      hint: "Delete a purchase requisition" },
  { key: "purchase.hr-approve", label: "Purchase · HR Approval", hint: "HR-approve or HR-reject a raised PR" },
  { key: "station",    label: "Station",     hint: "Station terminal & hourly-leave report" },
  { key: "demand",     label: "Raise Demand", hint: "Procurement — create material demand forms" },
  { key: "po",         label: "Create PO",    hint: "Procurement — create purchase orders" },
  { key: "grn",        label: "Make GRN",     hint: "Procurement — create goods-receiving reports" },
  { key: "inspection", label: "Inspection",   hint: "Procurement — incoming material inspection (QC)" },
  { key: "store",      label: "Parts Store",  hint: "Spare-parts inventory: categories, parts, in/out transactions" },
  { key: "capa",       label: "CAPA",         hint: "Corrective & preventive action reports (quality complaints)" },
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
  purchase: ["purchase.raise", "purchase.edit", "purchase.receive", "purchase.delete", "purchase.hr-approve"],
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

// ============ Roles ============
// Roles are data: a fixed set of built-ins plus any the owner creates in the
// app (custom_roles table). `builtin` roles can't be deleted; `editable` roles
// show in the Role Permissions UI (superadmin is fixed/full and never editable).
export interface RoleMeta { key: string; label: string; color: string; builtin: boolean; editable: boolean }

export const BUILTIN_ROLES: RoleMeta[] = [
  { key: "superadmin",  label: "Super Admin", color: "#5B21B6", builtin: true, editable: false },
  { key: "admin",       label: "Admin",       color: "#A32D2D", builtin: true, editable: true },
  { key: "hr",          label: "HR",          color: "#185FA5", builtin: true, editable: true },
  { key: "ceo",         label: "CEO",         color: "#0F766E", builtin: true, editable: true },
  { key: "procurement", label: "Procurement", color: "#B45309", builtin: true, editable: true },
  { key: "engineer",    label: "Engineer",    color: "#0891B2", builtin: true, editable: true },
  { key: "finance",     label: "Finance",     color: "#047857", builtin: true, editable: true },
  { key: "design",      label: "Design",      color: "#7C3AED", builtin: true, editable: true },
  { key: "accounts",    label: "Accounts",    color: "#BE185D", builtin: true, editable: true },
  { key: "other",       label: "Other",       color: "#64748B", builtin: true, editable: true },
];

// Built-in editable role keys — used to seed DEFAULT_PERMS. The full editable
// set (including custom roles) comes from loadRoles() at runtime.
export const EDITABLE_ROLES = BUILTIN_ROLES.filter(r => r.editable).map(r => r.key);

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

// ---- Role list (built-in + custom) ----
let rolesCache: { at: number; data: RoleMeta[] } | null = null;
export function invalidateRolesCache() { rolesCache = null; }

// Every role that exists — built-ins plus custom roles from the DB. Cached.
export async function loadRoles(): Promise<RoleMeta[]> {
  if (rolesCache && Date.now() - rolesCache.at < TTL_MS) return rolesCache.data;
  let custom: RoleMeta[] = [];
  try {
    const rows = await db.select().from(customRoles);
    custom = rows.map(r => ({ key: r.roleKey, label: r.label, color: r.color, builtin: false, editable: true }));
  } catch {
    // Table missing (not migrated yet) → just the built-ins.
  }
  const data = [...BUILTIN_ROLES, ...custom];
  rolesCache = { at: Date.now(), data };
  return data;
}

export async function isAssignableRole(key: string): Promise<boolean> {
  return (await loadRoles()).some(r => r.key === key);
}

// Turn a label into a short, url-safe role key (fits users.role varchar(20)).
export function slugifyRole(label: string): string {
  return label.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "role";
}

// Idempotently create the custom_roles table (same self-migrate pattern).
let customRolesEnsured = false;
export async function ensureCustomRolesTable() {
  if (customRolesEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS custom_roles (
      id serial PRIMARY KEY,
      role_key varchar(20) NOT NULL UNIQUE,
      label varchar(80) NOT NULL,
      color varchar(20) NOT NULL DEFAULT '#64748B',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  customRolesEnsured = true;
}

export async function createCustomRole(label: string, color: string): Promise<RoleMeta> {
  await ensureCustomRolesTable();
  const base = slugifyRole(label);
  const taken = new Set((await loadRoles()).map(r => r.key));
  let key = base, i = 2;
  while (taken.has(key)) key = `${base}-${i++}`.slice(0, 20);
  const cleanLabel = label.trim().slice(0, 80);
  await db.insert(customRoles).values({ roleKey: key, label: cleanLabel, color });
  invalidateRolesCache(); invalidatePermsCache();
  return { key, label: cleanLabel, color, builtin: false, editable: true };
}

export async function deleteCustomRole(key: string) {
  await ensureCustomRolesTable();
  await db.delete(customRoles).where(eq(customRoles.roleKey, key));
  await db.delete(rolePermissions).where(eq(rolePermissions.role, key));
  invalidateRolesCache(); invalidatePermsCache();
}

export async function loadAllPerms(): Promise<Record<string, RolePerm>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  // Seed every editable role from its default (custom roles start blank), then
  // let stored rows override.
  const data: Record<string, RolePerm> = {};
  for (const rm of await loadRoles()) {
    if (rm.key === "superadmin") continue; // always full — set below
    const d = DEFAULT_PERMS[rm.key];
    data[rm.key] = d ? { modules: [...d.modules], canEdit: d.canEdit } : { modules: [], canEdit: true };
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
