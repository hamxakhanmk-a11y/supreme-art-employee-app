import { requireAnyModule } from "@/lib/pageGuard";

export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["purchase.raise", "purchase.edit", "purchase.hr-approve"]);
  return <>{children}</>;
}
