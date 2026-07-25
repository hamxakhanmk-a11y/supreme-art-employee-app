import { requireModule } from "@/lib/pageGuard";

export default async function LeavesReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.leaves");
  return <>{children}</>;
}
