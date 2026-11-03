import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { stationTrips } from "@/lib/stationServer";
import StationReportClient from "./StationReportClient";
import PerEmployeeTotals from "./PerEmployeeTotals";
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

  return (
    <div className="fade-up">
      {/* Only the printout carries this heading; on screen the controls row starts the page. */}
      <h2 className="print-only" style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Every trip</h2>
      <StationReportClient trips={trips} from={from} to={to} tab={embedded ? "report" : undefined} terminalLink={!embedded} />

      <PerEmployeeTotals summary={summary} />
    </div>
  );
}
