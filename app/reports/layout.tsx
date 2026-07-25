import { requireAnyModule } from "@/lib/pageGuard";

// The user must have access to at least one report to open /reports at all.
// Each individual report page then adds its own per-report gate. Legacy
// "reports" umbrella grants pass through via the expansion in lib/permissions.
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule([
    "reports.attendance", "reports.leaves", "reports.halfday", "reports.salary",
    "reports.procurement", "reports.station", "reports.activity",
  ]);
  return <>{children}</>;
}
