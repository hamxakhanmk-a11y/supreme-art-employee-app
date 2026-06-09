"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const modules = [
  { key: "profile", label: "Profile", icon: "👤" },
  { key: "attendance", label: "Attendance", icon: "📋" },
];

const subNav: Record<string, { href: string; label: string; icon: string }[]> = {
  profile: [
    { href: "/", label: "Dashboard", icon: "▦" },
    { href: "/employees", label: "Employees", icon: "👥" },
  ],
  attendance: [
    { href: "/attendance", label: "Attendance", icon: "📋" },
  ],
};

function pathToModule(path: string): string {
  if (path.startsWith("/attendance")) return "attendance";
  if (path === "/" || path.startsWith("/employees")) return "profile";
  return "profile";
}

export default function TopNav() {
  const pathname = usePathname();
  const activeModule = pathToModule(pathname);
  const links = subNav[activeModule] || [];

  const isSubActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/employees") return pathname === "/employees" || /^\/employees\/\d+/.test(pathname);
    if (href === "/attendance") return pathname.startsWith("/attendance");
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
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      {/* Top row: brand + primary tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 1.75rem",
          height: 68,
          gap: 32,
        }}
      >
        {/* Brand with real logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "var(--fg)",
          }}
        >
          <Image
            src="/logo.png"
            alt="Supreme Art"
            width={140}
            height={48}
            priority
            style={{ height: 48, width: "auto", objectFit: "contain" }}
          />
          <div style={{
            paddingLeft: 12,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.2,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", letterSpacing: 0.3 }}>
              HR Portal
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 2, letterSpacing: 0.4, textTransform: "uppercase" }}>
              Employee Management
            </div>
          </div>
        </Link>

        {/* Primary module tabs */}
        <nav style={{ display: "flex", gap: 4, height: "100%", alignItems: "stretch", marginLeft: 12 }}>
          {modules.map((m) => {
            const active = m.key === activeModule;
            return (
              <Link
                key={m.key}
                href={subNav[m.key]?.[0]?.href || "/"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: active ? "var(--primary)" : "#555",
                  background: active ? "linear-gradient(180deg, #fff 0%, #e8f1fb 100%)" : "transparent",
                  borderBottom: `3px solid ${active ? "var(--primary)" : "transparent"}`,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 15 }}>{m.icon}</span> {m.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Right slot — date */}
        <div style={{ fontSize: 11, color: "#888", textAlign: "right", lineHeight: 1.3 }}>
          <div style={{ fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.4 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short" })}
          </div>
          <div>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
        </div>
      </div>

      {/* Sub-navigation row */}
      {links.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 1.75rem",
            height: 44,
            gap: 4,
            background: "#fbf9f6",
            borderTop: "1px solid var(--border)",
          }}
        >
          {links.map((link) => {
            const active = isSubActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "#fff" : "#666",
                  background: active ? "var(--primary)" : "transparent",
                  borderRadius: 6,
                  transition: "all 0.15s",
                  boxShadow: active ? "0 2px 6px rgba(24,95,165,0.25)" : "none",
                }}
              >
                <span style={{ fontSize: 13, opacity: 0.9 }}>{link.icon}</span> {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
