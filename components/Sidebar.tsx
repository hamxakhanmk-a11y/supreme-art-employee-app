"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/components/MeProvider";
import { getSubNav, pathToModule } from "@/components/nav-config";
import { useFlowIndicator } from "@/components/useFlowIndicator";

// The vertical sub-nav column, sitting between the top bar and the page.
// Only renders when the current module has sub-tabs — hidden entirely on
// pages that don't (Attendance, Salary, /store/*, Profile modules that
// don't have Employees access, etc.).

const HIDE_ON = ["/login"];

export default function Sidebar() {
  const pathname = usePathname();
  const meState = useMe();
  const me = meState.user ? { ...meState.user, modules: meState.modules } : null;
  // Liquid selector that glides between the sub-nav items.
  const flowRef = useFlowIndicator<HTMLElement>("y", ".sb-item.active", pathname, [meState.modules.join(","), meState.user?.role]);

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

  // How strongly a link matches the current path (longer = more specific), or
  // -1 for no match. Only the single best match is highlighted — otherwise a
  // parent like /station would also match /station/out, leaving two "active"
  // items (and the flowing pill covers only one, hiding the other's text).
  const matchLen = (href: string): number => {
    if (href === "/") return pathname === "/" ? 1 : -1;
    if (href === "/kpi") return pathname === "/kpi" ? href.length : -1;
    if (href === "/employees") return (pathname === "/employees" || /^\/employees\/\d+/.test(pathname)) ? href.length : -1;
    if (pathname === href) return href.length;
    if (pathname.startsWith(href + "/")) return href.length;
    return -1;
  };
  let activeHref = "";
  let bestLen = -1;
  for (const l of links) {
    const len = matchLen(l.href);
    if (len > bestLen) { bestLen = len; activeHref = l.href; }
  }
  const isActive = (href: string) => bestLen >= 0 && href === activeHref;

  return (
    <aside
      ref={flowRef as React.RefObject<HTMLElement>}
      className="app-sidebar no-print flow-connected"
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
      <span className="flow-indicator flow-indicator-y" aria-hidden="true" />
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
