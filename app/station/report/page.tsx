import { redirect } from "next/navigation";

type SP = { from?: string; to?: string };

// The Report lives inside Who's Out now, as its second view. Old links and
// bookmarks land there, keeping any date range they carried.
export default async function StationReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const p = new URLSearchParams({ tab: "report" });
  if (sp.from) p.set("from", sp.from);
  if (sp.to) p.set("to", sp.to);
  redirect(`/station/out?${p.toString()}`);
}
