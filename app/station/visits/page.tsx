import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { stationTrips } from "@/lib/stationServer";
import { karachiNow } from "@/lib/gateTime";
import VisitsReportClient, { type VisitRow, type Staff } from "./VisitsReportClient";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Where everyone went in a period: one row per employee who left the factory,
// visits and time split Personal / Official, and every reason they gave.
// Opens on today; This month and a custom range are a click away.
export default async function VisitsReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = karachiNow().date;   // UTC would still be yesterday until 5am
  const from = ISO.test(sp.from || "") ? sp.from! : today;
  const to = ISO.test(sp.to || "") ? sp.to! : today;

  const [trips, staff] = await Promise.all([
    stationTrips(from, to),
    // Everyone on the books, for "show everyone" — the ones who stayed in too.
    db.select({ id: employees.id, empCode: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
  ]);

  type Reason = { text: string; n: number; first: number };
  type Acc = VisitRow & { reasonMap: { personal: Map<string, Reason>; official: Map<string, Reason> } };
  const byEmp = new Map<number, Acc>();

  // Oldest first, so a reason's spelling is the one it was first given with.
  trips.slice().reverse().forEach((t, i) => {
    let a = byEmp.get(t.employeeId);
    if (!a) {
      a = {
        employeeId: t.employeeId, empCode: t.empCode, name: t.name,
        personal: { visits: 0, minutes: 0 }, official: { visits: 0, minutes: 0 },
        outNow: false, personalReasons: [], officialReasons: [],
        reasonMap: { personal: new Map(), official: new Map() },
      };
      byEmp.set(t.employeeId, a);
    }
    const kind = t.type === "official" ? "official" : "personal";
    a[kind].visits++;
    a[kind].minutes += t.minutes ?? 0;   // a trip still open today has no time yet
    if (t.inAt === null) a.outNow = true;

    // The same place typed twice is one place, whatever the capitals or spaces.
    const text = (t.reason || "").trim().replace(/\s+/g, " ") || "No reason given";
    const key = text.toLowerCase();
    const r = a.reasonMap[kind].get(key);
    if (r) r.n++; else a.reasonMap[kind].set(key, { text, n: 1, first: i });
  });

  const order = (m: Map<string, Reason>) =>
    [...m.values()].sort((x, y) => y.n - x.n || x.first - y.first).map(r => ({ text: r.text, n: r.n }));

  const rows: VisitRow[] = [...byEmp.values()]
    .map(({ reasonMap, ...a }) => ({
      ...a,
      personalReasons: order(reasonMap.personal),
      officialReasons: order(reasonMap.official),
    }))
    .sort((a, b) =>
      (b.personal.minutes + b.official.minutes) - (a.personal.minutes + a.official.minutes)
      || (b.personal.visits + b.official.visits) - (a.personal.visits + a.official.visits)
      || a.name.localeCompare(b.name));

  const everyone: Staff[] = staff.map(s => ({ id: s.id, empCode: s.empCode, name: `${s.firstName} ${s.lastName}` }));

  return <VisitsReportClient rows={rows} everyone={everyone} from={from} to={to} today={today} />;
}
