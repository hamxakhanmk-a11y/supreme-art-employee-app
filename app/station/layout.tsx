import { requireAnyModule } from "@/lib/pageGuard";
import { STATION_KEYS } from "@/lib/permissions";

// Station holds several sections, each with its own permission row; any one of
// them lets a role in. Each section's own layout checks its row.
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(STATION_KEYS, "station");
  return <>{children}</>;
}
