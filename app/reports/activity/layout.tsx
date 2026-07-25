import { requireModule } from "@/lib/pageGuard";

export default async function ActivityReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.activity");
  return <>{children}</>;
}
