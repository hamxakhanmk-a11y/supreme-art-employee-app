"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Top-level modules (primary tabs)
const modules = [
  { key: "profile", label: "Profile", icon: "👤" },
  // Future: { key: "attendance", label: "Attendance", icon: "⏰" },
  // Future: { key: "payroll", label: "Payroll", icon: "💰" },
];

// Sub-navigation under each module
const subNav: Record<string, { href: string; label: string }[]> = {
  profile: [
    { href: "/", label: "Dashboard" },
    { href: "/employees", label: "Employees" },
    { href: "/employees/new", label: "Add Employee" },
    { href: "/employees/form/print", label: "Print Blank Form" },
  ],
};

// Map any URL path to the parent module
function pathToModule(path: string): string {
  if (path === "/" || path.startsWith("/employees")) return "profile";
  return "profile";
}

export default function TopNav() {
  const pathname = usePathname();
  const activeModule = pathToModule(pathname);
  const links = subNav[activeModule] || [];

  const isSubActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/employees") {
      // Only highlight "Employees" if we're on list page or a detail page (not /new or /form)
      return pathname === "/employees" || /^\/employees\/\d+/.test(pathname);
    }
    return pathname === href;
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Top row: brand + primary tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 1.75rem",
          height: 56,
          gap: 32,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "var(--fg)",
          }}
        >
          <span style={{ color: "var(--primary)", fontSize: 18 }}>◆</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>
              SUPREME ART
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: -1, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Employee Management
            </div>
          </div>
        </Link>

        {/* Primary module tabs */}
        <nav style={{ display: "flex", gap: 4, height: "100%", alignItems: "stretch" }}>
          {modules.map((m) => {
            const active = m.key === activeModule;
            return (
              <Link
                key={m.key}
                href={subNav[m.key]?.[0]?.href || "/"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: active ? "var(--primary)" : "#555",
                  borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
              >
                <span>{m.icon}</span> {m.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Right slot */}
        <div style={{ fontSize: 11, color: "#aaa" }}>
          © 2026
        </div>
      </div>

      {/* Sub-navigation row */}
      {links.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 1.75rem",
            height: 42,
            gap: 4,
            background: "#fafafa",
          }}
        >
          {links.map((link) => {
            const active = isSubActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "6px 14px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "var(--primary)" : "#666",
                  background: active ? "var(--info-bg)" : "transparent",
                  borderRadius: 6,
                  transition: "all 0.15s",
                }}
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
