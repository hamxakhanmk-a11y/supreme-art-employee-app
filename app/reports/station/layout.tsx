import { requireModule } from "@/lib/pageGuard";

// Station data lives here too, so this report needs the station permission
// (in addition to reports access from the parent layout).
export default async function StationReportLayout({ children }: { children: React.ReactNode }) {
  await requireModule("station");
  return <>{children}</>;
}
