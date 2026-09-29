import { currentlyOut, outOn } from "@/lib/stationServer";
import { tripsOn, vehiclesOut } from "@/lib/fleetServer";
import WhoIsOutClient from "./WhoIsOutClient";

export const dynamic = "force-dynamic";

type SP = { date?: string };

export default async function WhoIsOutPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || "") ? sp.date! : today;
  const isToday = date === today;

  const out = isToday ? await currentlyOut() : await outOn(date);
  let vehicles: any[] = [];
  try { vehicles = isToday ? await vehiclesOut() : await tripsOn(date); }
  catch (e: any) { console.warn("Vehicles unavailable:", e?.message); }
  return <WhoIsOutClient initial={out} initialVehicles={vehicles} date={date} isToday={isToday} />;
}
