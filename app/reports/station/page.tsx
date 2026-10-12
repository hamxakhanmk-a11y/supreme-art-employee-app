// The Station report, surfaced under Reports so it sits alongside the other
// registers. The same view Station → Who's Out shows as its Report, so the
// two can't drift — but a page of its own here, under its own permission.
import StationReportView, { reportRange } from "@/app/station/report/StationReportView";

export const dynamic = "force-dynamic";

export default async function ReportsStationPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = reportRange(await searchParams);
  return <StationReportView from={from} to={to} />;
}
