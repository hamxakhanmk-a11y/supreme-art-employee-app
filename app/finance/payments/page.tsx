import { loadPayables } from "@/lib/payablesServer";
import FinanceClient from "../FinanceClient";

export const dynamic = "force-dynamic";

// Every payment made to suppliers (payment vouchers), voided ones on request.
export default async function PaymentsPage() {
  return <FinanceClient data={await loadPayables()} view="payments" />;
}
