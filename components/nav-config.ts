// Shared navigation config used by both the top bar (TopNav) and the
// left sub-nav column (Sidebar). Pure functions/data — no React, no state.

export type Role = "superadmin" | "admin" | "hr" | "ceo" | "procurement";

export interface ModuleDef {
  key: string;
  label: string;
  module?: string;
  anyModule?: string[];
  superadminOnly?: boolean;
}

// `module` gates the tab on the role's permission set (see lib/permissions.ts).
// `superadminOnly` is reserved for the owner. Profile has neither — always shown.
export const MODULES_BASE: ModuleDef[] = [
  { key: "profile",    label: "Profile" },
  { key: "attendance", label: "Attendance", module: "attendance" },
  { key: "forms",      label: "Forms",      module: "forms" },
  { key: "reports",    label: "Reports",    module: "reports" },
  { key: "salary",     label: "Salary",     module: "salary" },
  { key: "kpi",        label: "KPI",        module: "kpi" },
  { key: "purchase",   label: "Purchase",   module: "purchase" },
  { key: "station",    label: "Station",    module: "station" },
  { key: "procurement", label: "Procurement", anyModule: ["demand", "po", "grn", "inspection"] },
  { key: "store",      label: "Store",      module: "store" },
  { key: "users",      label: "Users",      superadminOnly: true },
];

// Default landing page for each top-nav module (used when the user clicks the
// module name in the topbar). Always lands on the module's overview.
export const MODULE_HOME: Record<string, string> = {
  profile: "/",
  attendance: "/attendance",
  forms: "/forms",
  reports: "/reports",
  salary: "/salary",
  kpi: "/kpi",
  purchase: "/purchase",
  station: "/station",
  procurement: "/procurement",
  store: "/store",
  users: "/admin/users",
};

const OVERVIEW_FORMS = { href: "/forms", label: "← Overview" };
const OVERVIEW_REPORTS = { href: "/reports", label: "← Overview" };

// The sub-nav (rendered as a left sidebar) is context-aware: on a module's
// overview page no items are shown (the page itself lists every section as a
// card). Once the user enters a section, only that section's items appear,
// with a back-to-overview link on top.
export function getSubNav(path: string, module: string): { href: string; label: string }[] {
  switch (module) {
    case "profile":
      return [
        { href: "/", label: "Dashboard" },
        { href: "/employees", label: "Employees" },
      ];
    case "attendance":
      return [{ href: "/attendance", label: "Mark Today" }];
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
      if (path.startsWith("/leave"))  return [OVERVIEW_FORMS, { href: "/forms/leave", label: "Leave Form" }];
      return [];
    }
    case "reports": {
      if (path === "/reports") return [];
      if (path.startsWith("/reports/attendance"))   return [OVERVIEW_REPORTS, { href: "/reports/attendance", label: "Attendance Register" }];
      if (path.startsWith("/reports/leaves"))       return [OVERVIEW_REPORTS, { href: "/reports/leaves", label: "Leave History" }];
      if (path.startsWith("/reports/half-day"))     return [OVERVIEW_REPORTS, { href: "/reports/half-day", label: "Half-Day History" }];
      if (path.startsWith("/reports/salary"))       return [OVERVIEW_REPORTS, { href: "/reports/salary", label: "Salary Records" }];
      if (path.startsWith("/reports/procurement")) return [OVERVIEW_REPORTS, { href: "/reports/procurement", label: "Procurement" }];
      if (path.startsWith("/reports/station"))     return [OVERVIEW_REPORTS, { href: "/reports/station", label: "Hourly Leaves" }];
      if (path.startsWith("/reports/activity"))    return [OVERVIEW_REPORTS, { href: "/reports/activity", label: "Activity Log" }];
      return [];
    }
    case "salary":
      return [{ href: "/salary", label: "Generate Slips" }];
    case "kpi":
      return [
        { href: "/kpi", label: "Overview" },
        { href: "/kpi/assign", label: "Assign Templates" },
        { href: "/kpi/entry", label: "Monthly Entry" },
        { href: "/kpi/reports", label: "Reports" },
      ];
    case "purchase":
      return [{ href: "/purchase", label: "PR Register" }];
    case "station":
      return [{ href: "/station", label: "Terminal" }, { href: "/station/report", label: "Report" }];
    case "procurement":
      return [
        { href: "/procurement/demand", label: "Demand" },
        { href: "/procurement/po", label: "Purchase Order" },
        { href: "/procurement/grn", label: "GRN" },
        { href: "/procurement/inspection", label: "Inspection" },
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
  if (path.startsWith("/reports")) return "reports";
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
