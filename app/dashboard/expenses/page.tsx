// Total Expense, by category — the detail behind the Super Admin dashboard's expense tile.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { dashboardRange, loadExpenses } from "@/lib/ownerDashboard";
import RangePicker from "../RangePicker";
import ExpenseDetail from "./ExpenseDetail";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; recv?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login?next=/dashboard/expenses");
  if (user.role !== "superadmin") redirect("/");
  const sp = await searchParams;
  const { from, to, today } = dashboardRange(sp);
  const received = sp.recv === "1";
  const summary = await loadExpenses(from, to, received ? "received" : "ordered");
  return (
    <div className="fade-up od">
      <div className="od-top">
        <Link href={`/?efrom=${from}&eto=${to}${received ? "&erecv=1" : ""}`} className="btn btn-back btn-sm">← Dashboard</Link>
        <RangePicker from={from} to={to} today={today} keep={received ? { recv: "1" } : {}} />
        <div className="od-seg" role="group" aria-label="Ordered or received">
          <Link href={`/dashboard/expenses?from=${from}&to=${to}`} className={received ? "" : "on"}>Ordered</Link>
          <Link href={`/dashboard/expenses?from=${from}&to=${to}&recv=1`} className={received ? "on" : ""}>Received</Link>
        </div>
      </div>
      <ExpenseDetail summary={summary} />
    </div>
  );
}
