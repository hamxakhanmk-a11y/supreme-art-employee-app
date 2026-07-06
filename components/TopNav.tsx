"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Role = "superadmin" | "admin" | "hr" | "ceo";

const MODULES_BASE: { key: string; label: string; roles: Role[] | null }[] = [
  { key: "profile",    label: "Profile",    roles: null },
  { key: "attendance", label: "Attendance", roles: null },
  { key: "forms",      label: "Forms",      roles: null },
  { key: "reports",    label: "Reports",    roles: null },
  { key: "salary",     label: "Salary",     roles: null },
  { key: "kpi",        label: "KPI",        roles: null },
  { key: "users",      label: "Users",      roles: ["superadmin"] },
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
      return [];
    }
    case "salary":
      return [{ href: "/salary", label: "Generate Slips" }];
    case "kpi": {
      if (path === "/kpi") return []; // overview
      return [
        { href: "/kpi", label: "← Overview" },
        { href: "/kpi/assign", label: "Assign Templates" },
        { href: "/kpi/entry", label: "Monthly Entry" },
      ];
    }
    case "users":
      return [{ href: "/admin/users", label: "All Users" }];
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
  users: "/admin/users",
};

function pathToModule(path: string): string {
  if (path.startsWith("/forms")) return "forms";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/salary")) return "salary";
  if (path.startsWith("/kpi")) return "kpi";
  if (path.startsWith("/attendance")) return "attendance";
  if (path.startsWith("/admin/users")) return "users";
  // Legacy leave routes resolve to forms module.
  if (path.startsWith("/leave")) return "forms";
  return "profile";
}

const HIDE_ON = ["/login", "/setup", "/set-password"];

interface MeUser { id: number; email: string; name: string; role: Role }

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const hidden = HIDE_ON.some(p => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (hidden) return;
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.authenticated) setMe(d.user);
    }).catch(() => {});
  }, [hidden, pathname]);

  if (hidden) return null;
  const activeModule = pathToModule(pathname);
  const links = getSubNav(pathname, activeModule);
  const modules = MODULES_BASE.filter(m => !m.roles || (me && m.roles.includes(me.role)));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const isSubActive = (href: string) => {
    if (href === "/") return pathname === "/";
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
