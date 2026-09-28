import { currentlyOut } from "@/lib/stationServer";
import { vehiclesOut } from "@/lib/fleetServer";
import WhoIsOutClient from "./WhoIsOutClient";

export const dynamic = "force-dynamic";

export default async function WhoIsOutPage() {
  const out = await currentlyOut();
  let vehicles: Awaited<ReturnType<typeof vehiclesOut>> = [];
  try { vehicles = await vehiclesOut(); }
  catch (e: any) { console.warn("Vehicles out unavailable:", e?.message); }
  return <WhoIsOutClient initial={out} initialVehicles={vehicles} />;
}
