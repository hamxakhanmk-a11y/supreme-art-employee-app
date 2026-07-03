import Link from "next/link";

export const dynamic = "force-dynamic";

export default function KpiLanding() {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI &amp; Performance</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
          Enter each month&apos;s figures (sales, invoices, output&hellip;) and the app scores every
          department against its own formula.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <KpiCard
          href="/kpi/entry"
          icon="✍️"
          title="Monthly Entry"
          urdu="ماہانہ اندراج"
          desc="Pick a month and type each department's input values. KPI scores compute automatically from the formula."
        />
        <KpiCard
          href="/kpi"
          icon="📊"
          title="KPI Dashboard"
          urdu="کارکردگی ڈیش بورڈ"
          desc="Per-department and per-designation scores with month-over-month trend and Excel export."
          soon
        />
      </div>

      {/* How it works / current status */}
      <div className="card" style={{ marginTop: 22, borderLeft: "4px solid var(--brand)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>How KPI is calculated here</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>
          <li>Each <strong>department</strong> has its own formula (its metrics, weights and targets).</li>
          <li>HR enters that month&apos;s raw values &mdash; e.g. sales, invoices, units produced.</li>
          <li>The app scores each metric against target, applies the weights, and produces the KPI %.</li>
          <li>Scores roll up into department and designation views.</li>
        </ol>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text3)" }}>
          Department formulas are being added one by one. Once a department&apos;s formula is set,
          its input fields appear on the Monthly Entry screen.
        </div>
      </div>
    </div>
  );
}

function KpiCard({ href, icon, title, urdu, desc, soon }: {
  href: string; icon: string; title: string; urdu: string; desc: string; soon?: boolean;
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
      opacity: soon ? 0.75 : 1,
    }}>
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
          fontSize: 18, fontWeight: 800,
          flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.2 }}>
            {title}{soon && <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 8, padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.22)" }}>SOON</span>}
          </div>
          <div className="urdu" style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{urdu}</div>
        </div>
      </div>
      <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </Link>
  );
}
