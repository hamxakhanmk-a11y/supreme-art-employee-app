"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/employees", label: "Employees", icon: "👤" },
  { href: "/employees/new", label: "Add Employee", icon: "＋" },
  { href: "/employees/form/print", label: "Blank Form (Print)", icon: "🖨" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{
        width: 210,
        background: "#fff",
        borderRight: "1px solid var(--border)",
        padding: "1rem 0",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "0.25rem 1rem 1rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--primary)" }}>◆</span> Supreme Art
        </div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
          Employee Management
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0", overflowY: "auto" }}>
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 1rem",
                fontSize: 13,
                color: active ? "var(--primary)" : "#555",
                background: active ? "var(--info-bg)" : "transparent",
                borderLeft: `3px solid ${active ? "var(--primary)" : "transparent"}`,
                fontWeight: active ? 600 : 500,
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              <span style={{ width: 16, display: "inline-block", textAlign: "center" }}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", fontSize: 11, color: "#aaa", textAlign: "center" }}>
        © 2026 Supreme Art
      </div>
    </aside>
  );
}
