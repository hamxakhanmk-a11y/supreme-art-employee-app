import { loadPayables } from "@/lib/payablesServer";
import FinanceClient from "../FinanceClient";

export const dynamic = "force-dynamic";

// After the GRR: the supplier's invoice checked against the PO and GRR, approved, paid — stage by stage.
export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const { supplier } = await searchParams;
  return <FinanceClient data={await loadPayables()} view="payables" supplier={supplier} />;
}
