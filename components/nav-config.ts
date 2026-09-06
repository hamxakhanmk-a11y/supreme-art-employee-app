// Shared navigation config used by both the top bar (TopNav) and the
// left sub-nav column (Sidebar). Pure functions/data — no React, no state.

// Roles are data (built-ins + owner-created custom roles), so this is just a string.
export type Role = string;

export interface ModuleDef {
  key: string;
  label: string;
  module?: string;
  anyModule?: string[];
  superadminOnly?: boolean;
}

// `module` gates the tab on the role's permission set (see lib/permissions.ts).
// `superadminOnly` is reserved for the owner. Profile has neither — always shown.
// Sub-key sets for the top-nav modules that were split into finer permissions.
// Anything else that needs to know "does the user have any Reports access?"
// or "does the user have any Purchase access?" should import these lists.
export const REPORT_SUBKEYS = [
  "reports.attendance", "reports.leaves", "reports.halfday", "reports.salary",
  "reports.procurement", "reports.station", "reports.activity",
];
export const PURCHASE_SUBKEYS = ["purchase.raise", "purchase.edit", "purchase.receive", "purchase.delete", "purchase.hr-approve"];

export const MODULES_BASE: ModuleDef[] = [
  { key: "profile",    label: "Profile" },
  { key: "attendance", label: "Attendance", module: "attendance" },
  { key: "forms",      label: "Forms",      module: "forms" },
  { key: "salary",     label: "Salary",     module: "salary" },
  // KPI is intentionally dormant. Keep its routes/config below so it can be
  // restored later without rebuilding; adding this MODULES_BASE entry back
  // is all that is needed to return the top-nav tab.
  { key: "purchase",   label: "Purchase",   anyModule: PURCHASE_SUBKEYS },
  { key: "station",    label: "Station",    module: "station" },
  { key: "procurement", label: "Procurement", anyModule: ["demand", "po", "grn"] },
  { key: "store",      label: "Store",      module: "store" },
  { key: "activity",   label: "Activity Log", module: "reports.activity" },
  { key: "users",      label: "Users",      superadminOnly: true },
];

// Default landing page for each top-nav module (used when the user clicks the
// module name in the topbar). Always lands on the module's overview.
export const MODULE_HOME: Record<string, string> = {
  profile: "/",
  attendance: "/attendance",
  forms: "/forms",
  salary: "/salary",
  kpi: "/kpi",
  purchase: "/purchase",
  station: "/station",
  procurement: "/procurement",
  store: "/store",
  activity: "/reports/activity",
  users: "/admin/users",
};

const OVERVIEW_FORMS = { href: "/forms", label: "← Overview" };

// The sub-nav (rendered as a left sidebar) is context-aware: on a module's
// overview page no items are shown (the page itself lists every section as a
// card). Once the user enters a section, only that section's items appear,
// with a back-to-overview link on top.
export interface SubNavItem {
  href: string;
  label: string;
  variant?: "report";   // rendered as a distinct pill (see Sidebar / globals.css)
  needs?: string;        // module key the item requires (else it's filtered out)
  superadminOnly?: boolean; // hidden from everyone except the owner
}

export function getSubNav(path: string, module: string): SubNavItem[] {
  switch (module) {
    case "profile":
      return [
        { href: "/", label: "Dashboard" },
        { href: "/employees", label: "Employees" },
      ];
    case "attendance":
      return [
        { href: "/attendance", label: "Mark Today" },
        { href: "/attendance/overtime", label: "Overtime" },
        { href: "/reports/attendance", label: "📊 Attendance Register", variant: "report", needs: "reports.attendance" },
        { href: "/reports/leaves", label: "📊 Leave History", variant: "report", needs: "reports.leaves" },
        { href: "/reports/half-day", label: "📊 Half-Day History", variant: "report", needs: "reports.halfday" },
        { href: "/reports/overtime", label: "📊 Overtime Report", variant: "report", needs: "reports.attendance" },
      ];
    case "forms": {
      if (path === "/forms") return [];
      if (path === "/forms/leave" || path === "/forms/leave-settings") {
        return [
          OVERVIEW_FORMS,
          { href: "/forms/leave", label: "Leave Form" },
          { href: "/forms/leave-settings", label: "Leave Settings" },
        ];
      }
      if (path === "/forms/half-day") return [OVERVIEW_FORMS, { href: "/forms/half-day", label: "Half-Day Form" }];
      if (path === "/forms/file")     return [OVERVIEW_FORMS, { href: "/forms/file", label: "File Signed Form" }];
      if (path === "/forms/approvals") return [OVERVIEW_FORMS, { href: "/forms/approvals", label: "Pending Approvals" }];
      if (path.startsWith("/forms/capa")) {
        return [OVERVIEW_FORMS, { href: "/forms/capa", label: "CAPA Reports", needs: "capa" }];
      }
      if (path.startsWith("/leave"))  return [OVERVIEW_FORMS, { href: "/forms/leave", label: "Leave Form" }];
      return [];
    }
    case "salary":
      return [
        { href: "/salary", label: "Generate Slips" },
        { href: "/reports/salary", label: "📊 Salary Records", variant: "report", needs: "reports.salary" },
      ];
    case "kpi":
      return [
        { href: "/kpi", label: "Overview" },
        { href: "/kpi/assign", label: "Assign Templates" },
        { href: "/kpi/entry", label: "Monthly Entry" },
        { href: "/kpi/reports", label: "Reports" },
      ];
    case "purchase":
      return [
        { href: "/purchase", label: "PR Register" },
        { href: "/reports/purchase/expenses", label: "📊 Expense Report", variant: "report", superadminOnly: true },
      ];
    case "station":
      return [
        { href: "/station", label: "Terminal" },
        { href: "/station/out", label: "Who's Out" },
        { href: "/station/report", label: "Report" },
      ];
    case "procurement":
      return [
        { href: "/procurement/demand", label: "Demand" },
        { href: "/procurement/po", label: "Purchase Order" },
        { href: "/procurement/grn", label: "GRR" },
        { href: "/reports/procurement", label: "📊 Report", variant: "report", needs: "reports.procurement" },
        { href: "/reports/procurement/suppliers", label: "📊 Supplier Directory", variant: "report", superadminOnly: true },
      ];
    case "store":
      // Store has its own overview landing + iframe-owned sidebar for the
      // internal sections, so no employee-app sub-nav is shown here.
      return [];
    case "users":
      return [
        { href: "/admin/users", label: "All Users" },
        { href: "/admin/roles", label: "Role Permissions" },
      ];
    default:
      return [];
  }
}

export function pathToModule(path: string): string {
  if (path.startsWith("/forms")) return "forms";
  // Reports live under their owning module tab now (the Reports tab is gone).
  if (path.startsWith("/reports/salary")) return "salary";
  if (path.startsWith("/reports/procurement")) return "procurement";
  if (path.startsWith("/reports/station")) return "station";
  if (path.startsWith("/reports/activity")) return "activity";
  if (path.startsWith("/reports")) return "attendance"; // register / leaves / half-day (+ bare)
  if (path.startsWith("/salary")) return "salary";
  if (path.startsWith("/kpi")) return "kpi";
  if (path.startsWith("/purchase")) return "purchase";
  if (path.startsWith("/station")) return "station";
  if (path.startsWith("/procurement")) return "procurement";
  if (path.startsWith("/store")) return "store";
  if (path.startsWith("/attendance")) return "attendance";
  if (path.startsWith("/admin/")) return "users";
  if (path.startsWith("/leave")) return "forms";
  return "profile";
}
