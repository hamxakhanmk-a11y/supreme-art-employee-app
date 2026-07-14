import Link from "next/link";
import { db } from "@/lib/db";
import { employees, attendance } from "@/lib/schema";
import { and, gte, lte } from "drizzle-orm";
import { stationMinutesByEmpDay } from "@/lib/stationServer";
import MonthlyRegisterClient from "./MonthlyRegisterClient";

export const dynamic = "force-dynamic";

type SP = { year?: string; month?: string };

export default async function AttendanceHistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year || String(now.getFullYear()));
  const month = parseInt(sp.month || String(now.getMonth() + 1)); // 1-12

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0); // last day of month
  const firstISO = first.toISOString().slice(0, 10);
  const lastISO = last.toISOString().slice(0, 10);
  const daysInMonth = last.getDate();

  const [emps, rows] = await Promise.all([
    db.select({
      id: employees.id,
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: employees.department,
      designation: employees.designation,
      status: employees.status,
      createdAt: employees.createdAt,
    }).from(employees).orderBy(employees.employeeId),
    db.select({
      employeeId: attendance.employeeId,
      date: attendance.date,
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      officialLeaveMin: attendance.officialLeaveMin,
      personalLeaveMin: attendance.personalLeaveMin,
    }).from(attendance).where(and(gte(attendance.date, firstISO), lte(attendance.date, lastISO))),
  ]);

  // Hourly-leave minutes now come from the Station terminal, not manual entry.
  const stMap = await stationMinutesByEmpDay(firstISO, lastISO);
  const records = rows.map(r => {
    const a = stMap.get(`${r.employeeId}-${r.date}`);
    return { ...r, officialLeaveMin: a?.official ?? 0, personalLeaveMin: a?.personal ?? 0 };
  });

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Monthly Attendance Register</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>One row per employee, one column per day, totals on the right.</p>
        </div>
        <Link href="/attendance" className="btn btn-primary">＋ Mark Today</Link>
      </div>
      <MonthlyRegisterClient
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        employees={emps}
        records={records}
      />
    </div>
  );
}
