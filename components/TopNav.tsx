"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const modules = [
  { key: "profile",    label: "Profile" },
  { key: "attendance", label: "Attendance" },
  { key: "forms",      label: "Forms" },
  { key: "reports",    label: "Reports" },
];

const subNav: Record<string, { href: string; label: string }[]> = {
  profile: [
    { href: "/", label: "Dashboard" },
    { href: "/employees", label: "Employees" },
  ],
  attendance: [
    { href: "/attendance", label: "Mark Today" },
  ],
  forms: [
    { href: "/forms", label: "Overview" },
    { href: "/forms/leave", label: "Leave Form" },
    { href: "/forms/half-day", label: "Half-Day Form" },
    { href: "/forms/approvals", label: "Pending Approvals" },
  ],
  reports: [
    { href: "/reports", label: "Overview" },
    { href: "/reports/attendance", label: "Attendance Register" },
    { href: "/reports/leaves", label: "Leave History" },
    { href: "/reports/half-day", label: "Half-Day History" },
  ],
};

function pathToModule(path: string): string {
  if (path.startsWith("/forms")) return "forms";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/attendance")) return "attendance";
  // Legacy leave routes resolve to forms module.
  if (path.startsWith("/leave")) return "forms";
  return "profile";
}

export default function TopNav() {
  const pathname = usePathname();
  const activeModule = pathToModule(pathname);
  const links = subNav[activeModule] || [];

  const isSubActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/employees") return pathname === "/employees" || /^\/employees\/\d+/.test(pathname);
    if (href === "/forms") return pathname === "/forms";
    if (href === "/reports") return pathname === "/reports";
    return pathname.startsWith(href);
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
                href={subNav[m.key]?.[0]?.href || "/"}
                className={`mode-btn ${active ? "active" : ""}`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ textAlign: "right", lineHeight: 1.05, color: "var(--brand)", fontWeight: 700 }}>
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
