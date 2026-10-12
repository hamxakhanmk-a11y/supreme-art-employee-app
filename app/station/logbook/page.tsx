import { redirect } from "next/navigation";

type SP = { vehicle?: string; month?: string };

// The Log Book lives inside Vehicles now, as its first tab. Old links and
// bookmarks land there, keeping the vehicle and month they carried.
export default async function LogBookPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const p = new URLSearchParams({ tab: "logbook" });
  if (sp.vehicle) p.set("vehicle", sp.vehicle);
  if (sp.month) p.set("month", sp.month);
  redirect(`/station/vehicles?${p.toString()}`);
}
