import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function AttendanceHistoryPage() {
  const emps = await db.select({
    id: employees.id,
    employeeId: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
  }).from(employees).orderBy(employees.firstName);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attendance History</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Filter, print, and export records.</p>
        </div>
        <Link href="/attendance" className="btn btn-primary">＋ Mark Today</Link>
      </div>
      <HistoryClient employees={emps} />
    </div>
  );
}
