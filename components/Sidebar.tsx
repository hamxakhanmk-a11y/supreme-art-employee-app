"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/components/MeProvider";
import { getSubNav, pathToModule } from "@/components/nav-config";

// The vertical sub-nav column, sitting between the top bar and the page.
// Only renders when the current module has sub-tabs — hidden entirely on
// pages that don't (Attendance, Salary, /store/*, Profile modules that
// don't have Employees access, etc.).

const HIDE_ON = ["/login"];

export default function Sidebar() {
  const pathname = usePathname();
  const meState = useMe();
  const me = meState.user ? { ...meState.user, modules: meState.modules } : null;

  if (HIDE_ON.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;

  const activeModule = pathToModule(pathname);
  const canModule = (key: string) => !!me && (me.role === "superadmin" || me.modules.includes(key));

  let links = getSubNav(pathname, activeModule);
  // Same role-based filtering as the top bar
  if (activeModule === "profile" && me && !canModule("employees")) {
    links = links.filter(l => l.href !== "/employees");
  }
  if (activeModule === "procurement" && me) {
    const stageOf: Record<string, string> = {
      "/procurement/demand": "demand", "/procurement/po": "po",
      "/procurement/grn": "grn",
    };
    links = links.filter(l => !stageOf[l.href] || canModule(stageOf[l.href]));
  }
  // Items that declare a `needs` module are hidden unless the role has it
  // (e.g. the Procurement → Report link needs reports.procurement).
  if (me) links = links.filter(l => !l.needs || canModule(l.needs));

  if (links.length === 0) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/kpi") return pathname === "/kpi";
    if (href === "/employees") return pathname === "/employees" || /^\/employees\/\d+/.test(pathname);
    if (href === pathname) return true;
    if (pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <aside
      className="app-sidebar no-print"
      style={{
        width: 222,
        minWidth: 222,
        background: "var(--bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "12px 0",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`sb-item ${link.variant === "report" ? "sb-item--report" : ""} ${active ? "active" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </aside>
  );
}
