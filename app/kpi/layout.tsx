import { requireModule } from "@/lib/pageGuard";

export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireModule("kpi");
  return <>{children}</>;
}
