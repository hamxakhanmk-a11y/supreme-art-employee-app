import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { sql, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let total = 0;
  let active = 0;
  let inactive = 0;
  try {
    const rows = await db.select({
      total: sql<number>`count(*)::int`,
    }).from(employees);
    total = rows[0]?.total ?? 0;

    const a = await db.select({ c: sql<number>`count(*)::int` })
      .from(employees).where(eq(employees.status, "active"));
    active = a[0]?.c ?? 0;

    const i = await db.select({ c: sql<number>`count(*)::int` })
      .from(employees).where(eq(employees.status, "inactive"));
    inactive = i[0]?.c ?? 0;
  } catch {
    // DB not migrated yet — render zeros
  }

  const stats = [
    { label: "Total Employees", value: total, sub: "All records", color: "var(--primary)" },
    { label: "Active", value: active, sub: "Currently employed", color: "var(--success)" },
    { label: "Inactive", value: inactive, sub: "Resigned / on hold", color: "var(--danger)" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Overview of employee records</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="form-label" style={{ marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="section-title">Quick Actions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/employees/new" className="btn btn-primary">＋ Add New Employee</Link>
          <Link href="/employees" className="btn">👤 View Employees</Link>
          <Link href="/employees/form/print" className="btn btn-print">🖨 Print Blank Form</Link>
        </div>
      </div>
    </div>
  );
}
