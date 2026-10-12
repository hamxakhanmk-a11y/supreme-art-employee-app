import { requireModule } from "@/lib/pageGuard";

// Who's Out and its Report: the gate's own pages (Station).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("station");
  return <>{children}</>;
}
