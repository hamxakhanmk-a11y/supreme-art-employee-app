import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc } from "drizzle-orm";
import LeaveHistoryClient from "./LeaveHistoryClient";

export const dynamic = "force-dynamic";

export default async function LeaveHistoryPage() {
  const [emps, types] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(employees).orderBy(asc(employees.firstName)),
    db.select().from(leaveTypes).orderBy(asc(leaveTypes.name)),
  ]);
  return (
    <div className="fade-up">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave History</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Filter, print, export leave records.</p>
      </div>
      <LeaveHistoryClient employees={emps} leaveTypes={types} />
    </div>
  );
}
