// Attendance Register — single-month renders the existing daily grid,
// multi-month renders a cross-month summary.
import Link from "next/link";
import { db } from "@/lib/db";
import { employees, attendance } from "@/lib/schema";
import { and, gte, lte } from "drizzle-orm";
import MonthlyRegisterClient from "@/app/attendance/history/MonthlyRegisterClient";
import RangeRegisterClient from "@/app/attendance/history/RangeRegisterClient";

export const dynamic = "force-dynamic";

type SP = {
  year?: string; month?: string;       // legacy single-month params
  from?: string; to?: string;          // YYYY-MM range params
};

function parseYM(s: string | undefined, fallback: { y: number; m: number }): { y: number; m: number } {
  if (!s) return fallback;
  const m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (!m) return fallback;
  const y = parseInt(m[1]);
  const mo = parseInt(m[2]);
  if (mo < 1 || mo > 12) return fallback;
  return { y, m: mo };
}

function monthsBetween(from: { y: number; m: number }, to: { y: number; m: number }): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  let y = from.y, m = from.m;
  // Cap at 24 months to keep memory bounded.
  for (let i = 0; i < 24; i++) {
    out.push({ y, m });
    if (y === to.y && m === to.m) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export default async function AttendanceReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };

  // Resolve from/to. Legacy `year`/`month` params still work (single month).
  let from: { y: number; m: number };
  let to: { y: number; m: number };
  if (sp.from || sp.to) {
    from = parseYM(sp.from, nowYM);
    to = parseYM(sp.to, from);
  } else if (sp.year || sp.month) {
    const single = { y: parseInt(sp.year || String(nowYM.y)), m: parseInt(sp.month || String(nowYM.m)) };
    from = single; to = single;
  } else {
    from = nowYM; to = nowYM;
  }

  // Ensure from <= to (swap if user picked them backwards).
  const fromIdx = from.y * 12 + (from.m - 1);
  const toIdx = to.y * 12 + (to.m - 1);
  if (fromIdx > toIdx) [from, to] = [to, from];

  const months = monthsBetween(from, to);
  const firstISO = `${from.y}-${String(from.m).padStart(2, "0")}-01`;
  const lastDate = new Date(to.y, to.m, 0); // last day of `to` month
  const lastISO = `${to.y}-${String(to.m).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;

  const [emps, rows] = await Promise.all([
    db.select({
      id: employees.id,
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: employees.department,
      designation: employees.designation,
      status: employees.status,
    }).from(employees).orderBy(employees.employeeId),
    db.select({
      employeeId: attendance.employeeId,
      date: attendance.date,
      status: attendance.status,
      checkIn: attendance.checkIn,
    }).from(attendance).where(and(gte(attendance.date, firstISO), lte(attendance.date, lastISO))),
  ]);

  const isSingleMonth = months.length === 1;

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attendance Register</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {isSingleMonth
              ? "One row per employee, one column per day, totals on the right."
              : "Pick a date range — single month shows daily detail, multiple months show a per-month summary."}
          </p>
        </div>
        <Link href="/attendance" className="btn btn-primary">＋ Mark Today</Link>
      </div>
      {isSingleMonth ? (
        <MonthlyRegisterClient
          year={from.y}
          month={from.m}
          daysInMonth={new Date(from.y, from.m, 0).getDate()}
          employees={emps}
          records={rows}
          rangeFrom={`${from.y}-${String(from.m).padStart(2, "0")}`}
          rangeTo={`${to.y}-${String(to.m).padStart(2, "0")}`}
        />
      ) : (
        <RangeRegisterClient
          from={from}
          to={to}
          months={months}
          employees={emps}
          records={rows}
        />
      )}
    </div>
  );
}
