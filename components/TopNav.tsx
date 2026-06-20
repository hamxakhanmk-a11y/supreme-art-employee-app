"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const modules = [
  { key: "profile", label: "Profile" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
];

const subNav: Record<string, { href: string; label: string }[]> = {
  profile: [
    { href: "/", label: "Dashboard" },
    { href: "/employees", label: "Employees" },
  ],
  attendance: [
    { href: "/attendance", label: "Mark Today" },
    { href: "/attendance/history", label: "History" },
  ],
  leave: [
    { href: "/leave", label: "Requests" },
    { href: "/leave/apply", label: "Apply Leave" },
    { href: "/leave/history", label: "History" },
  ],
};

function pathToModule(path: string): string {
  if (path.startsWith("/leave")) return "leave";
  if (path.startsWith("/attendance")) return "attendance";
  return "profile";
}

export default function TopNav() {
  const pathname = usePathname();
  const activeModule = pathToModule(pathname);
  const links = subNav[activeModule] || [];

  const isSubActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/employees") return pathname === "/employees" || /^\/employees\/\d+/.test(pathname);
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
        {/* Brand: small logo + "Supreme Art Portal" */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)" }}>
          <Image src="/logo.png" alt="Supreme Art" width={28} height={28} priority style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Supreme Art <span style={{ color: "var(--brand)" }}>HR Portal</span>
          </span>
        </Link>

        {/* Module switcher (tracker mode-switch pill) */}
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

        {/* Date — two-line maroon stack */}
        <div style={{ textAlign: "right", lineHeight: 1.05, color: "var(--brand)", fontWeight: 700 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", opacity: 0.85, textTransform: "uppercase" }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short" })}
          </div>
          <div style={{ fontSize: 13, letterSpacing: "0.04em", marginTop: 2 }}>
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Sub-nav — chip-style tabs flush left */}
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
