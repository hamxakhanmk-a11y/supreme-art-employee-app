import { redirect } from "next/navigation";

type SP = { from?: string; to?: string };

// The Cards Logbook lives inside PSO Cards now, as its first tab. Old links
// and bookmarks land there, keeping any date range they carried.
export default async function CardsLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const p = new URLSearchParams({ tab: "logbook" });
  if (sp.from) p.set("from", sp.from);
  if (sp.to) p.set("to", sp.to);
  redirect(`/station/pso?${p.toString()}`);
}
