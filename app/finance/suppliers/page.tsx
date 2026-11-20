import { loadPayables } from "@/lib/payablesServer";
import FinanceClient from "../FinanceClient";

export const dynamic = "force-dynamic";

// What each supplier is owed, and how far past due.
export default async function SupplierBalancesPage() {
  return <FinanceClient data={await loadPayables()} view="suppliers" />;
}
