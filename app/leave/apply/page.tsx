import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import ApplyLeaveClient from "./ApplyLeaveClient";

export const dynamic = "force-dynamic";

export default async function ApplyLeavePage() {
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
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Apply for Leave</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Submit a leave request. You can also print a blank form for manual filling.</p>
      </div>
      <ApplyLeaveClient employees={emps} leaveTypes={types} />
    </div>
  );
}
