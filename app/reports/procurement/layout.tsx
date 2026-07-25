import { requireModule } from "@/lib/pageGuard";

export default async function ProcurementReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.procurement");
  return <>{children}</>;
}
