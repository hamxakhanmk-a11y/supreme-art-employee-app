// The Super Admin's dashboard: spending for a period, attendance to keep an eye on, and who and what is
// outside the factory right now. Laid out like the Tracker's CEO dashboard (see DashboardView). Everyone
// else keeps the Profile dashboard in app/page.tsx.
import { currentlyOut } from "@/lib/stationServer";
import { vehiclesOut } from "@/lib/fleetServer";
import { loadExpenses, cnicAlerts, lateComers, daysOffOver2, cardsOut } from "@/lib/ownerDashboard";
import { formatMins } from "@/lib/station";
import DashboardView, { type DashData, type Loaded, type Range } from "./DashboardView";

// The server runs on UTC; the gate keeps Karachi time.
const karachiTime = (isoStr: string) =>
  new Date(isoStr).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit", hour12: true });
// How long since: minutes and hours, and days once it has been out more than a day.
function since(isoStr: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(isoStr).getTime()) / 60000));
  if (m < 1440) return formatMins(m);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

async function settle<T>(p: Promise<T>): Promise<Loaded<T>> {
  try { return { ok: true, data: await p }; }
  catch (e: any) { console.warn("Dashboard section failed:", e?.message); return { ok: false, error: e?.message || "Could not load" }; }
}

// Expense and Attendance each have their own period; Late today, CNIC expiry and Outside are as of now.
export default async function OwnerDashboard({ exp: er, att: ar, receivedOnly, today }: { exp: Range; att: Range; receivedOnly: boolean; today: string }) {
  const [exp, cnic, late, lateToday, off, people, vehicles, cards] = await Promise.all([
    settle(loadExpenses(er.from, er.to, receivedOnly).then(s => ({
      total: s.total, purchase: s.purchase, procurement: s.procurement, earlierPos: s.procurementEarlierPos, skipped: s.skipped.length,
      // Only the totals travel to the page; every line is on the expense page.
      categories: s.categories.map(c => ({ category: c.category, total: c.total, purchase: c.purchase, procurement: c.procurement, lines: c.lines.length })),
    }))),
    settle(cnicAlerts(today)),
    settle(lateComers(ar.from, ar.to, today)),
    settle(lateComers(today, today, today)),
    settle(daysOffOver2(ar.from, ar.to)),
    settle(currentlyOut().then(rows => rows.map(r => ({ ...r, at: karachiTime(r.outAt), since: since(r.outAt) })))),
    settle(vehiclesOut().then(rows => rows.map(r => ({
      id: r.id as number, vehicleNo: String(r.vehicleNo), vehicleName: String(r.vehicleName || ""), driver: String(r.driver || ""),
      destination: String(r.destination || ""), at: karachiTime(r.outAt), since: since(r.outAt),
    })))),
    settle(cardsOut()),
  ]);
  const data: DashData = { expRange: er, attRange: ar, receivedOnly, today, exp, cnic, late, lateToday, off, people, vehicles, cards };
  return <DashboardView data={data} />;
}
