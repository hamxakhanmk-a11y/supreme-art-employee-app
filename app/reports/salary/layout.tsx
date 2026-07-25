import { requireModule } from "@/lib/pageGuard";

export default async function SalaryReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.salary");
  return <>{children}</>;
}
