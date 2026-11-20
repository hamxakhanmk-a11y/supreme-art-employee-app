import { requireModule } from "@/lib/pageGuard";

// Finance → Payables, Payments, Supplier Balances: all one grant (Payables), its actions each a grant of their own.
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireModule("payables");
  return <>{children}</>;
}
