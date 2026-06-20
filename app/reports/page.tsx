import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReportsLanding() {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Reports</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Browse, filter, print and export historical data.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <ReportCard
          href="/reports/attendance"
          icon="📅"
          title="Attendance Register"
          urdu="حاضری کا رجسٹر"
          desc="Monthly grid: one row per employee, one column per day, totals on the right."
        />
        <ReportCard
          href="/reports/leaves"
          icon="📋"
          title="Leave History"
          urdu="رخصت کی تاریخ"
          desc="All approved / rejected / pending leave requests with filters and Excel export."
        />
        <ReportCard
          href="/reports/half-day"
          icon="½"
          title="Half-Day History"
          urdu="آدھے دن کی تاریخ"
          desc="All half-day requests by employee, status, date range."
        />
      </div>
    </div>
  );
}

function ReportCard({ href, icon, title, urdu, desc }: {
  href: string; icon: string; title: string; urdu: string; desc: string;
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
          fontSize: 18, fontWeight: 800,
          flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.2 }}>{title}</div>
          <div className="urdu" style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{urdu}</div>
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
