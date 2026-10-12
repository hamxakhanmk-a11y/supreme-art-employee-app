"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MonthlyReport from "./MonthlyReport";
import type { FleetMonth } from "@/lib/fleetMonthly";

// The page around the report: its title, the month, and the way back to the
// terminal, on one line like the other Station pages.
export default function MonthlyClient({ data, readOnly }: { data: FleetMonth; readOnly: boolean }) {
  const router = useRouter();
  return (
    <div className="fade-up">
      <div className="no-print page-head">
        <h1>📊 Monthly Report</h1>
        <span className="spacer" />
        <span className="head-filter">
          Month
          <input type="month" value={data.month}
            onChange={e => e.target.value && router.push(`/station/monthly?month=${e.target.value}`, { scroll: false })} />
        </span>
        <Link href="/station" className="btn btn-xs">🏭 Terminal</Link>
      </div>
      <MonthlyReport data={data} readOnly={readOnly} />
    </div>
  );
}
