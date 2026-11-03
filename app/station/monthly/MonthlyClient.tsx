"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MonthlyReport from "./MonthlyReport";
import type { FleetMonth } from "@/lib/fleetMonthly";

// The page around the report: the month picker and the way back to the
// terminal sit in the report's own controls row, so there is one line above the sheet.
export default function MonthlyClient({ data, readOnly, canOpenCards }: { data: FleetMonth; readOnly: boolean; canOpenCards: boolean }) {
  const router = useRouter();
  return (
    <div className="fade-up">
      <MonthlyReport data={data} readOnly={readOnly} canOpenCards={canOpenCards}
        lead={
          <span className="head-filter">
            Month
            <input type="month" value={data.month}
              onChange={e => e.target.value && router.push(`/station/monthly?month=${e.target.value}`, { scroll: false })} />
          </span>
        }
        nav={<Link href="/station" className="btn btn-xs">🏭 Terminal</Link>} />
    </div>
  );
}
