"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const modules = [
  { key: "profile",    label: "Profile" },
  { key: "attendance", label: "Attendance" },
  { key: "forms",      label: "Forms" },
  { key: "reports",    label: "Reports" },
  { key: "salary",     label: "Salary" },
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
    { href: "/forms/file", label: "File Signed Form" },
    { href: "/forms/approvals", label: "Pending Approvals" },
  ],
  reports: [
    { href: "/reports", label: "Overview" },
    { href: "/reports/attendance", label: "Attendance Register" },
    { href: "/reports/leaves", label: "Leave History" },
    { href: "/reports/half-day", label: "Half-Day History" },
  ],
  salary: [
    { href: "/salary", label: "Salary Slip" },
  ],
};

function pathToModule(path: string): string {
  if (path.startsWith("/forms")) return "forms";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/salary")) return "salary";
  if (path.startsWith("/attendance")) return "attendance";
  // Legacy leave routes resolve to forms module.
  if (path.startsWith("/leave")) return "forms";
  return "profile";
}

const HIDE_ON = ["/login", "/setup", "/set-password"];

interface MeUser { id: number; email: string; name: string; role: "superadmin" | "admin" | "hr" | "ceo" }

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
  const links = subNav[activeModule] || [];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

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
                  {me.role === "superadmin" && (
                    <Link href="/admin/users" onClick={() => setMenuOpen(false)} style={menuItem}>
                      👥 Manage users
                    </Link>
                  )}
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
