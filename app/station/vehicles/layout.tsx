import { requireModule } from "@/lib/pageGuard";

// Vehicles — Log Book and the vehicle list — its own permission row.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("station.vehicles");
  return <>{children}</>;
}
