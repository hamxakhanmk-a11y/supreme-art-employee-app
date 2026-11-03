// Total Expense, by category — the detail behind the Super Admin dashboard's expense tile.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { dashboardRange, loadExpenses } from "@/lib/ownerDashboard";
import RangePicker from "../RangePicker";
import ExpenseDetail from "./ExpenseDetail";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login?next=/dashboard/expenses");
  if (user.role !== "superadmin") redirect("/");
  const { from, to, today } = dashboardRange(await searchParams);
  const summary = await loadExpenses(from, to);
  return (
    <div className="fade-up od">
      <div className="od-top">
        <Link href={`/?efrom=${from}&eto=${to}`} className="btn btn-back btn-sm">← Dashboard</Link>
        <RangePicker from={from} to={to} today={today} />
      </div>
      <ExpenseDetail summary={summary} />
    </div>
  );
}
