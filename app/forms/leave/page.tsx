// Leave form lives at /forms/leave — re-uses the existing ApplyLeaveClient.
import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import ApplyLeaveClient from "@/app/leave/apply/ApplyLeaveClient";

export const dynamic = "force-dynamic";

export default async function LeaveFormPage() {
  const [emps, types] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
      designation: employees.designation, department: employees.department,
    }).from(employees).where(eq(employees.status, "active")).orderBy(asc(employees.firstName)),
    db.select().from(leaveTypes).orderBy(asc(leaveTypes.name)),
  ]);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Application</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Apply for any leave type. Print blank for manual filling or submit digitally.</p>
      </div>
      <ApplyLeaveClient employees={emps} leaveTypes={types} />
    </div>
  );
}
