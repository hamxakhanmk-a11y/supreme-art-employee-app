import { requireModule } from "@/lib/pageGuard";

// Salary figures live here too, so this report needs the salary permission
// (in addition to reports access from the parent layout).
export default async function SalaryReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("salary");
  return <>{children}</>;
}
