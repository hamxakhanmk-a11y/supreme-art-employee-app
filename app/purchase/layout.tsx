import { requireAnyModule } from "@/lib/pageGuard";

export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["purchase.raise", "purchase.edit", "purchase.delete", "purchase.hr-approve"]);
  return <>{children}</>;
}
