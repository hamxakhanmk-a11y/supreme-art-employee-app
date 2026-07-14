import Link from "next/link";
import { db } from "@/lib/db";
import { employees, stationLeaves } from "@/lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { formatMins, LEAVE_STYLE } from "@/lib/station";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string };

export default async function StationReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const from = sp.from || first;
  const to = sp.to || now.toISOString().slice(0, 10);

  const [emps, leaves] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
      department: employees.department, stationPin: employees.stationPin,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    db.select().from(stationLeaves)
      .where(and(gte(stationLeaves.date, from), lte(stationLeaves.date, to))),
  ]);

  type Agg = { personal: number; official: number; trips: number; open: number };
  const byEmp = new Map<number, Agg>();
  for (const l of leaves) {
    const a = byEmp.get(l.employeeId) ?? { personal: 0, official: 0, trips: 0, open: 0 };
    a.trips++;
    if (l.inAt === null) a.open++;
    const m = l.minutes ?? 0;
    if (l.type === "official") a.official += m; else a.personal += m;
    byEmp.set(l.employeeId, a);
  }

  const rows = emps.map(e => ({ ...e, agg: byEmp.get(e.id) ?? { personal: 0, official: 0, trips: 0, open: 0 } }))
    .sort((a, b) => b.agg.personal - a.agg.personal || a.firstName.localeCompare(b.firstName));

  const totPersonal = rows.reduce((s, r) => s + r.agg.personal, 0);
  const totOfficial = rows.reduce((s, r) => s + r.agg.official, 0);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Time Outside the Factory</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Hourly leaves punched at the Station. Personal <strong style={{ color: LEAVE_STYLE.personal.color }}>{formatMins(totPersonal)}</strong> · Official <strong style={{ color: LEAVE_STYLE.official.color }}>{formatMins(totOfficial)}</strong> in range.
          </p>
        </div>
        <Link href="/station" className="btn">🏭 Terminal</Link>
      </div>

      <form method="GET" className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14, fontSize: 13, color: "var(--text2)" }}>
        <span style={{ fontWeight: 600 }}>From</span>
        <input type="date" name="from" defaultValue={from} style={{ width: 150 }} />
        <span>→</span>
        <input type="date" name="to" defaultValue={to} style={{ width: 150 }} />
        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
      </form>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Department</th><th style={{ textAlign: "center" }}>PIN</th>
              <th className="num">Trips</th>
              <th className="num" style={{ color: LEAVE_STYLE.personal.color }}>Personal (deducted)</th>
              <th className="num" style={{ color: LEAVE_STYLE.official.color }}>Official (excused)</th>
              <th className="num">Total out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const total = r.agg.personal + r.agg.official;
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.employeeId}{r.agg.open > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}> · out now</span>}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.department || "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--brand)" }}>{r.stationPin || "—"}</td>
                  <td className="num">{r.agg.trips || ""}</td>
                  <td className="num" style={{ color: r.agg.personal ? LEAVE_STYLE.personal.color : "var(--text3)", fontWeight: r.agg.personal ? 700 : 400 }}>{r.agg.personal ? formatMins(r.agg.personal) : "—"}</td>
                  <td className="num" style={{ color: r.agg.official ? LEAVE_STYLE.official.color : "var(--text3)" }}>{r.agg.official ? formatMins(r.agg.official) : "—"}</td>
                  <td className="num-strong">{total ? formatMins(total) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        The <strong>PIN</strong> column is each employee&apos;s Station PIN — share it with them so they can punch in/out. Only <strong style={{ color: LEAVE_STYLE.personal.color }}>Personal</strong> time is subtracted from worked hours in the attendance register.
      </div>
    </div>
  );
}
