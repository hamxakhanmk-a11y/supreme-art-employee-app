// Half-Day History — same client as leave history, filtered to half-day only.
import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc } from "drizzle-orm";
import LeaveHistoryClient from "@/app/leave/history/LeaveHistoryClient";

export const dynamic = "force-dynamic";

export default async function HalfDayReport() {
  const [emps, types] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(employees).orderBy(asc(employees.firstName)),
    db.select().from(leaveTypes).orderBy(asc(leaveTypes.name)),
  ]);
  return (
    <div className="fade-up">
      <LeaveHistoryClient employees={emps} leaveTypes={types} onlyHalfDay />
    </div>
  );
}
