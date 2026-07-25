import { requireModule } from "@/lib/pageGuard";

export default async function HalfDayReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.halfday");
  return <>{children}</>;
}
