import { requireModule } from "@/lib/pageGuard";

// Monthly Report — the fleet sheet — its own permission row.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("station.monthly");
  return <>{children}</>;
}
