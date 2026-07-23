import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { roleCanAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parts Store — Supreme Art" };

export default async function StoreLandingPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/store");
  const allowed = await roleCanAccess(user.role, "store");
  if (!allowed) redirect("/");

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Parts Store</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
          Pick a module to open. Each module has its own parts, categories, and machines.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
        <ModuleCard
          href="/store/machinery"
          icon="⚙️"
          title="Machinery & Electrical"
          desc="Bearings, belts, seals, electrical, hydraulics, and every mechanical spare on the shop floor."
        />
        <ModuleCard
          href="/store/consumables"
          icon="🖨️"
          title="Inks & Consumables"
          desc="Printing inks, solvents, cleaning agents, and other consumables used up during production."
        />
      </div>
    </div>
  );
}

function ModuleCard({ href, icon, title, desc }: {
  href: string; icon: string; title: string; desc: string;
}) {
  return (
    <Link href={href} className="form-card" style={{
      display: "flex", flexDirection: "column",
      textDecoration: "none", color: "var(--text)",
      borderRadius: 12, overflow: "hidden",
      border: "1px solid var(--border)",
      background: "var(--bg)",
      boxShadow: "var(--shadow-sm)",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}>
      {/* Red header band */}
      <div style={{
        background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)",
        color: "#fff",
        padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800,
          flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.2 }}>{title}</div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "14px 18px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55 }}>{desc}</div>
        <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 700, letterSpacing: 0.3 }}>
          Open →
        </div>
      </div>
    </Link>
  );
}
