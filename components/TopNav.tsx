"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/components/MeProvider";
import { MODULES_BASE, MODULE_HOME, pathToModule } from "@/components/nav-config";
import { useFlowIndicator } from "@/components/useFlowIndicator";

const HIDE_ON = ["/login"];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const meState = useMe();
  const me = meState.user
    ? { ...meState.user, modules: meState.modules, canEdit: meState.canEdit }
    : null;
  const [menuOpen, setMenuOpen] = useState(false);
  // Liquid selector that glides between the module tabs.
  const flowRef = useFlowIndicator<HTMLDivElement>("x", ".mode-btn.active", pathname, [meState.modules.join(","), meState.user?.role]);
  const hidden = HIDE_ON.some(p => pathname === p || pathname.startsWith(p + "/"));

  if (hidden) return null;
  const activeModule = pathToModule(pathname);
  const canModule = (key: string) => !!me && (me.role === "superadmin" || me.modules.includes(key));

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
            Supreme Art <span style={{ color: "var(--brand)" }}>ERP</span>
          </span>
        </Link>

        <div ref={flowRef} className="mode-switch flow-connected" style={{ marginLeft: "1rem" }}>
          <span className="flow-indicator flow-indicator-x" aria-hidden="true" />
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

      {/* Sub-nav lives in the left sidebar now — see components/Sidebar.tsx */}
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
