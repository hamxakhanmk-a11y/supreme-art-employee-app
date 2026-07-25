import { requireModule } from "@/lib/pageGuard";

export default async function StationReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.station");
  return <>{children}</>;
}
