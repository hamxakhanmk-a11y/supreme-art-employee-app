import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { formatMins, LEAVE_STYLE } from "@/lib/station";
import { stationTrips } from "@/lib/stationServer";
import StationReportClient from "./StationReportClient";
import { karachiNow } from "@/lib/gateTime";

// Time outside the factory: every trip punched at the Station, then each
// employee's totals. Shown in two places — Station → Who's Out (its Report
// view, `embedded`) and Reports → Station (a page of its own).
export function reportRange(sp: { from?: string; to?: string }) {
  const today = karachiNow().date;   // UTC would still be yesterday until 5am
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return {
    from: iso.test(sp.from || "") ? sp.from! : `${today.slice(0, 8)}01`,
    to: iso.test(sp.to || "") ? sp.to! : today,
  };
}

export default async function StationReportView({ from, to, embedded = false }: {
  from: string; to: string;
  /** Inside the Who's Out tab: its title line is the tab's, so none here. */
  embedded?: boolean;
}) {

  const [emps, trips] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
      department: employees.department, stationPin: employees.stationPin,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    stationTrips(from, to),
  ]);

  type Agg = { personal: number; official: number; trips: number; open: number };
  const byEmp = new Map<number, Agg>();
  for (const l of trips) {
    const a = byEmp.get(l.employeeId) ?? { personal: 0, official: 0, trips: 0, open: 0 };
    a.trips++;
    if (l.inAt === null) a.open++;
    const m = l.minutes ?? 0;
    if (l.type === "official") a.official += m; else a.personal += m;
    byEmp.set(l.employeeId, a);
  }

  const summary = emps
    .map(e => ({ ...e, agg: byEmp.get(e.id) ?? { personal: 0, official: 0, trips: 0, open: 0 } }))
    .sort((a, b) => b.agg.personal - a.agg.personal || a.firstName.localeCompare(b.firstName));

  const totPersonal = summary.reduce((s, r) => s + r.agg.personal, 0);
  const totOfficial = summary.reduce((s, r) => s + r.agg.official, 0);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          {!embedded && <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Time Outside the Factory</h1>}
          <p style={{ color: "#888", marginTop: embedded ? 0 : 4, fontSize: 13 }}>
            Hourly leaves punched at the Station. Personal <strong style={{ color: LEAVE_STYLE.personal.color }}>{formatMins(totPersonal)}</strong> · Official <strong style={{ color: LEAVE_STYLE.official.color }}>{formatMins(totOfficial)}</strong> in range.
          </p>
        </div>
        {!embedded && <Link href="/station" className="btn">🏭 Terminal</Link>}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Every trip</h2>
      <StationReportClient trips={trips} from={from} to={to} tab={embedded ? "report" : undefined} />

      <h2 className="no-print" style={{ fontSize: 15, fontWeight: 700, margin: "26px 0 8px" }}>Per-employee totals</h2>
      <div className="card no-print" style={{ padding: 0, overflow: "auto" }}>
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
            {summary.map(r => {
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
      <div className="no-print" style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        The <strong>PIN</strong> column is each employee&apos;s Station PIN — share it with them so they can punch in/out.
      </div>
    </div>
  );
}
