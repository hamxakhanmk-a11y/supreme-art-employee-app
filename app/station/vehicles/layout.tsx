import { requireAnyModule } from "@/lib/pageGuard";

// Vehicles — the Log Book and All vehicles, each its own permission row; either opens the page.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["station.vehicles", "station.vehiclelist"], "station.vehicles");
  return <>{children}</>;
}
