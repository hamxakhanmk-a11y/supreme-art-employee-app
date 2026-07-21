import { requireAnyModule } from "@/lib/pageGuard";

// Procurement data lives here too, so this report needs at least one of the
// procurement stages (in addition to reports access from the parent layout).
export default async function ProcurementReportLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["demand", "po", "grn"]);
  return <>{children}</>;
}
