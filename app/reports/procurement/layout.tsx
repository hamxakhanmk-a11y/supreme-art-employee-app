import { requireAnyModule } from "@/lib/pageGuard";

// The subtree holds two separate reports with separate grants: the master
// procurement report (reports.procurement) and the Supplier Directory
// (suppliers), which roles like Engineer can have on its own. So the layout
// only checks for either — each page re-checks the one it actually needs.
export default async function ProcurementReportLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["reports.procurement", "suppliers"]);
  return <>{children}</>;
}
