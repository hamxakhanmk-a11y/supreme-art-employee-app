"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/components/MeProvider";

// `module` gates the tab on the role's permission set (see lib/permissions.ts).
// `superadminOnly` is reserved for the owner. Profile has neither — always shown.
const MODULES_BASE: { key: string; label: string; module?: string; anyModule?: string[]; superadminOnly?: boolean }[] = [
  { key: "profile",    label: "Profile" },
  { key: "attendance", label: "Attendance", module: "attendance" },
  { key: "forms",      label: "Forms",      module: "forms" },
  { key: "reports",    label: "Reports",    module: "reports" },
  { key: "salary",     label: "Salary",     module: "salary" },
  { key: "kpi",        label: "KPI",        module: "kpi" },
  { key: "purchase",   label: "Purchase",   module: "purchase" },
  { key: "station",    label: "Station",    module: "station" },
  { key: "procurement", label: "Procurement", anyModule: ["demand", "po", "grn"] },
  { key: "users",      label: "Users",      superadminOnly: true },
];

const OVERVIEW_FORMS = { href: "/forms", label: "← Overview" };
const OVERVIEW_REPORTS = { href: "/reports", label: "← Overview" };

// Sub-nav is context-aware: on an overview page no tabs are shown (the page
// itself lists every module as a card). Once the user enters a module, only
// that module's tabs are shown, with a back-to-overview tab on the left.
function getSubNav(path: string, module: string): { href: string; label: string }[] {
  switch (module) {
    case "profile":
      return [
        { href: "/", label: "Dashboard" },
        { href: "/employees", label: "Employees" },
      ];
    case "attendance":
      return [{ href: "/attendance", label: "Mark Today" }];
    case "forms": {
      if (path === "/forms") return []; // overview
      if (path === "/forms/leave" || path === "/forms/leave-settings") {
        return [
          OVERVIEW_FORMS,
          { href: "/forms/leave", label: "Leave Form" },
          { href: "/forms/leave-settings", label: "Leave Settings" },
        ];
      }
      if (path === "/forms/half-day") {
        return [OVERVIEW_FORMS, { href: "/forms/half-day", label: "Half-Day Form" }];
      }
      if (path === "/forms/file") {
        return [OVERVIEW_FORMS, { href: "/forms/file", label: "File Signed Form" }];
      }
      if (path === "/forms/approvals") {
        return [OVERVIEW_FORMS, { href: "/forms/approvals", label: "Pending Approvals" }];
      }
      // Legacy /leave routes
      if (path.startsWith("/leave")) {
        return [OVERVIEW_FORMS, { href: "/forms/leave", label: "Leave Form" }];
      }
      return [];
    }
    case "reports": {
      if (path === "/reports") return []; // overview
      if (path.startsWith("/reports/attendance")) {
        return [OVERVIEW_REPORTS, { href: "/reports/attendance", label: "Attendance Register" }];
      }
      if (path.startsWith("/reports/leaves")) {
        return [OVERVIEW_REPORTS, { href: "/reports/leaves", label: "Leave History" }];
      }
      if (path.startsWith("/reports/half-day")) {
        return [OVERVIEW_REPORTS, { href: "/reports/half-day", label: "Half-Day History" }];
      }
      if (path.startsWith("/reports/salary")) {
        return [OVERVIEW_REPORTS, { href: "/reports/salary", label: "Salary Records" }];
      }
      if (path.startsWith("/reports/station")) {
        return [OVERVIEW_REPORTS, { href: "/reports/station", label: "Hourly Leaves" }];
      }
      if (path.startsWith("/reports/activity")) {
        return [OVERVIEW_REPORTS, { href: "/reports/activity", label: "Activity Log" }];
      }
      return [];
    }
    case "salary":
      return [{ href: "/salary", label: "Generate Slips" }];
    case "kpi":
      // Always show the KPI tabs (including on the overview) so Reports etc.
      // are reachable from anywhere in the section.
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
      // Filtered per-stage permission in the component below.
      return [
        { href: "/procurement/demand", label: "Demand" },
        { href: "/procurement/po", label: "Purchase Order" },
        { href: "/procurement/grn", label: "GRN" },
      ];
    case "users":
      return [
        { href: "/admin/users", label: "All Users" },
        { href: "/admin/roles", label: "Role Permissions" },
      ];
    default:
      return [];
  }
}

// Default landing page for each top-nav module (used when the user clicks the
// module name in the topbar). Always lands on the module's overview.
const MODULE_HOME: Record<string, string> = {
  profile: "/",
  attendance: "/attendance",
  forms: "/forms",
  reports: "/reports",
  salary: "/salary",
  kpi: "/kpi",
  purchase: "/purchase",
  station: "/station",
  procurement: "/procurement",
  users: "/admin/users",
};

function pathToModule(path: string): string {
  if (path.startsWith("/forms")) return "forms";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/salary")) return "salary";
  if (path.startsWith("/kpi")) return "kpi";
  if (path.startsWith("/purchase")) return "purchase";
  if (path.startsWith("/station")) return "station";
  if (path.startsWith("/procurement")) return "procurement";
  if (path.startsWith("/attendance")) return "attendance";
  if (path.startsWith("/admin/")) return "users";
  // Legacy leave routes resolve to forms module.
  if (path.startsWith("/leave")) return "forms";
  return "profile";
}

const HIDE_ON = ["/login"];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const meState = useMe();
  const me = meState.user
    ? { ...meState.user, modules: meState.modules, canEdit: meState.canEdit }
    : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const hidden = HIDE_ON.some(p => pathname === p || pathname.startsWith(p + "/"));

  if (hidden) return null;
  const activeModule = pathToModule(pathname);
  const canModule = (key: string) => !!me && (me.role === "superadmin" || me.modules.includes(key));

  let links = getSubNav(pathname, activeModule);
  // Hide the Employees management tab from roles without that permission.
  if (activeModule === "profile" && me && !canModule("employees")) {
    links = links.filter(l => l.href !== "/employees");
  }
  // Show only the procurement stages the role can access.
  if (activeModule === "procurement" && me) {
    const stageOf: Record<string, string> = {
      "/procurement/demand": "demand", "/procurement/po": "po", "/procurement/grn": "grn",
    };
    links = links.filter(l => !stageOf[l.href] || canModule(stageOf[l.href]));
  }

  const modules = MODULES_BASE.filter(m => {
    if (m.superadminOnly) return me?.role === "superadmin";
    if (m.anyModule) return m.anyModule.some(canModule);
    if (m.module) return canModule(m.module);
    return true; // Profile — always available
  });

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const isSubActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/kpi") return pathname === "/kpi";
    if (href === "/employees") return pathname === "/employees" || /^\/employees\/\d+/.test(pathname);
    // Sibling routes can share a prefix (e.g. /forms/leave vs /forms/leave-settings),
    // so for the explicit sub-nav entries we require either an exact match or the
    // path to continue with a "/" (a nested sub-page).
    if (href === pathname) return true;
    if (pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Top row — 56px slim topbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 1.5rem",
          height: 56,
          gap: 16,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)" }}>
          <Image src="/logo.png" alt="Supreme Art" width={28} height={28} priority style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Supreme Art <span style={{ color: "var(--brand)" }}>HR Portal</span>
          </span>
        </Link>

        <div className="mode-switch" style={{ marginLeft: "1rem" }}>
          {modules.map((m) => {
            const active = m.key === activeModule;
            return (
              <Link
                key={m.key}
                href={MODULE_HOME[m.key] || "/"}
                className={`mode-btn ${active ? "active" : ""}`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {me && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: 999, padding: "5px 12px 5px 5px",
                cursor: "pointer", color: "var(--text)", fontWeight: 600, fontSize: 13,
              }}
              title={me.email}
            >
              <span style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "var(--brand)", color: "#fff",
                fontSize: 12, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {me.name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()}
              </span>
              {me.name.split(/\s+/)[0]}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.3, color: "var(--brand)", textTransform: "uppercase" }}>
                {me.role === "superadmin" ? "Owner" : me.role}
              </span>
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 61,
                  background: "var(--bg)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  minWidth: 200, padding: 6,
                }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{me.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>{me.email}</div>
                  </div>
                  <button onClick={signOut} style={{ ...menuItem, border: "none", width: "100%", textAlign: "left", background: "transparent", cursor: "pointer" }}>
                    ↪ Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: "right", lineHeight: 1.05, color: "var(--brand)", fontWeight: 700, marginLeft: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", opacity: 0.85, textTransform: "uppercase" }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short" })}
          </div>
          <div style={{ fontSize: 13, letterSpacing: "0.04em", marginTop: 2 }}>
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Sub-nav row */}
      {links.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 1.5rem",
            gap: 6,
            background: "var(--bg2)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {links.map((link) => {
            const active = isSubActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`tab ${active ? "active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

const menuItem: React.CSSProperties = {
  display: "block",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
  textDecoration: "none",
  borderRadius: 6,
};
