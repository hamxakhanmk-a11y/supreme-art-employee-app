import { requireAnyModule } from "@/lib/pageGuard";

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["demand", "po", "grn", "inspection"]);
  return <>{children}</>;
}
