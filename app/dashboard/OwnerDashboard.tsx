// The Super Admin's dashboard: spending for a period, attendance to keep an eye on, and who and what is
// outside the factory right now. Laid out like the Tracker's CEO dashboard (see DashboardView). Everyone
// else keeps the Profile dashboard in app/page.tsx.
import { currentlyOut } from "@/lib/stationServer";
import { vehiclesOut } from "@/lib/fleetServer";
import { loadExpenses, cnicAlerts, lateComers, daysOffOver2, cardsOut } from "@/lib/ownerDashboard";
import { formatMins } from "@/lib/station";
import DashboardView, { type DashData, type Loaded } from "./DashboardView";

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

export default async function OwnerDashboard({ from, to, today }: { from: string; to: string; today: string }) {
  const [exp, cnic, late, off, people, vehicles, cards] = await Promise.all([
    settle(loadExpenses(from, to).then(s => ({
      total: s.total, purchase: s.purchase, procurement: s.procurement, skipped: s.skipped.length,
      // Only the totals travel to the page; every line is on the expense page.
      categories: s.categories.map(c => ({ category: c.category, total: c.total, purchase: c.purchase, procurement: c.procurement, lines: c.lines.length })),
    }))),
    settle(cnicAlerts(today)),
    settle(lateComers(from, to, today)),
    settle(daysOffOver2(from, to)),
    settle(currentlyOut().then(rows => rows.map(r => ({ ...r, at: karachiTime(r.outAt), since: since(r.outAt) })))),
    settle(vehiclesOut().then(rows => rows.map(r => ({
      id: r.id as number, vehicleNo: String(r.vehicleNo), vehicleName: String(r.vehicleName || ""), driver: String(r.driver || ""),
      destination: String(r.destination || ""), at: karachiTime(r.outAt), since: since(r.outAt),
    })))),
    settle(cardsOut()),
  ]);
  const data: DashData = { from, to, today, exp, cnic, late, off, people, vehicles, cards };
  return <DashboardView data={data} />;
}
