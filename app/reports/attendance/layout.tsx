import { requireModule } from "@/lib/pageGuard";

export default async function AttendanceReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("reports.attendance");
  return <>{children}</>;
}
