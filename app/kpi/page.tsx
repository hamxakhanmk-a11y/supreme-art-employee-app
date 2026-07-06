import Link from "next/link";
import { byDepartment } from "@/lib/kpi/catalog";

export const dynamic = "force-dynamic";

export default function KpiLanding() {
  const groups = byDepartment();
  const totalDesig = groups.reduce((n, g) => n + g.designations.length, 0);
  const totalKpis = groups.reduce((n, g) => n + g.designations.reduce((m, d) => m + d.kpis.length, 0), 0);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI &amp; Performance</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {totalDesig} designations · {totalKpis} KPIs. Enter each month&apos;s figures and the app
            scores every role against its own formula.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/kpi/entry" className="btn btn-primary">✍️ Monthly Entry</Link>
        </div>
      </div>

      {/* Departments → designations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {groups.map(g => (
          <div key={g.department} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)",
              color: "#fff", padding: "10px 16px", fontSize: 13, fontWeight: 800, letterSpacing: 0.3,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>{g.department}</span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{g.designations.length} role{g.designations.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 1, background: "var(--border)" }}>
              {g.designations.map(d => (
                <Link key={d.code} href={`/kpi/entry?designation=${d.code}`} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  background: "var(--bg)", textDecoration: "none", color: "var(--text)",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: "var(--brand)",
                    background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6,
                    padding: "3px 6px", minWidth: 40, textAlign: "center",
                  }}>{d.code}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{d.title}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text3)" }}>{d.kpis.length} KPIs</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20, borderLeft: "4px solid var(--brand)", fontSize: 12, color: "var(--text3)" }}>
        Each role has its own KPI set, formulas, targets and units — replicated from your Excel tracker.
        HR enters the raw monthly figures; the app computes each KPI, its 🟢🟡🔴 status and a 0–10 score.
      </div>
    </div>
  );
}
