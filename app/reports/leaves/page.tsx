// Leave History (regular leaves only — half-day records get their own report).
import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc } from "drizzle-orm";
import LeaveHistoryClient from "@/app/leave/history/LeaveHistoryClient";

export const dynamic = "force-dynamic";

export default async function LeaveHistoryReport() {
  const [emps, types] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(employees).orderBy(asc(employees.firstName)),
    db.select().from(leaveTypes).orderBy(asc(leaveTypes.name)),
  ]);
  return (
    <div className="fade-up">
      <LeaveHistoryClient employees={emps} leaveTypes={types} excludeHalfDay />
    </div>
  );
}
