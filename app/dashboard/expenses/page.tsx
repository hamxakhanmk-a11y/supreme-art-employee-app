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
  const receivedOnly = sp.recv === "1";
  const summary = await loadExpenses(from, to, receivedOnly);
  return (
    <div className="fade-up od">
      <div className="od-top">
        <Link href={`/?efrom=${from}&eto=${to}${receivedOnly ? "&erecv=1" : ""}`} className="btn btn-back btn-sm">← Dashboard</Link>
        <RangePicker from={from} to={to} today={today} keep={receivedOnly ? { recv: "1" } : {}} />
        {receivedOnly && <span className="od-recv on" style={{ cursor: "default" }}>✓ Received only</span>}
      </div>
      <ExpenseDetail summary={summary} />
    </div>
  );
}
