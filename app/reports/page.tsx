import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReportsLanding() {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Reports</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Browse, filter, print and export historical data.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <ReportCard
          href="/reports/attendance"
          title="Attendance Register"
          desc="Monthly grid: one row per employee, one column per day, totals on the right."
        />
        <ReportCard
          href="/reports/leaves"
          title="Leave History"
          desc="All approved/rejected/pending leave requests with filters and Excel export."
        />
        <ReportCard
          href="/reports/half-day"
          title="Half-Day History"
          desc="All half-day requests by employee, status, date range."
        />
      </div>
    </div>
  );
}

function ReportCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card card-hover" style={{ textDecoration: "none", color: "var(--text)", display: "block" }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 8, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ fontSize: 12, color: "var(--brand)", marginTop: 12, fontWeight: 600 }}>Open →</div>
    </Link>
  );
}
