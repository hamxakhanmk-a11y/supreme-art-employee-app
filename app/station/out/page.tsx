import { currentlyOut, outOn } from "@/lib/stationServer";
import { tripsOn, vehiclesOut } from "@/lib/fleetServer";
import WhoIsOutClient from "./WhoIsOutClient";
import OutTabs from "./OutTabs";
import StationReportView, { reportRange } from "../report/StationReportView";
import { karachiNow } from "@/lib/gateTime";
import { requireAnyModule, grantsOf } from "@/lib/pageGuard";

export const dynamic = "force-dynamic";

type SP = { date?: string; from?: string; to?: string; tab?: string };

// Who's Out, one tab with two views: who is outside now (or on a chosen day),
// and the Report — every trip in a date range, with each person's totals.
export default async function WhoIsOutPage({ searchParams }: { searchParams: Promise<SP> }) {
  // Who's Out and its Report are each their own row; either opens the page.
  await requireAnyModule(["station.out", "station.outreport"], "station.out");
  const g = await grantsOf();
  const tabs = { out: g.see("station.out"), report: g.see("station.outreport") };
  const sp = await searchParams;
  const today = karachiNow().date;   // UTC would still be yesterday until 5am
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || "") ? sp.date! : today;
  const isToday = date === today;
  const { from, to } = reportRange(sp);

  const out = !tabs.out ? [] : isToday ? await currentlyOut() : await outOn(date);
  let vehicles: any[] = [];
  if (tabs.out) {
    try { vehicles = isToday ? await vehiclesOut() : await tripsOn(date); }
    catch (e: any) { console.warn("Vehicles unavailable:", e?.message); }
  }

  return (
    <OutTabs
      tab={(sp.tab === "report" && tabs.report) || !tabs.out ? "report" : "out"}
      tabs={tabs}
      out={tabs.out ? <WhoIsOutClient initial={out} initialVehicles={vehicles} date={date} isToday={isToday} embedded /> : null}
      report={tabs.report ? <StationReportView from={from} to={to} embedded /> : null}
    />
  );
}
