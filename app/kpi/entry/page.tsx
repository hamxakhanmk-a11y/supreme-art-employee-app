import Link from "next/link";

export const dynamic = "force-dynamic";

export default function KpiEntryPage() {
  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI &mdash; Monthly Entry</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Enter each department&apos;s figures for the month; KPI scores compute from the formula.
          </p>
        </div>
        <Link href="/kpi" className="btn">← Overview</Link>
      </div>

      <div className="card" style={{ borderLeft: "4px solid var(--brand)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Setup in progress</div>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, lineHeight: 1.6 }}>
          The month picker and per-department input fields appear here as each department&apos;s
          KPI formula is added. Send the first department&apos;s formula (its metrics, weights and
          targets) and its input fields &mdash; e.g. sales, invoices &mdash; will show up on this screen.
        </p>
      </div>
    </div>
  );
}
