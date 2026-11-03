import { db } from "@/lib/db";
import { employees, leaveTypes, leaveRequests } from "@/lib/schema";
import { asc, desc } from "drizzle-orm";
import LeaveRequestsClient from "./LeaveRequestsClient";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const [requests, emps, types] = await Promise.all([
    db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt)),
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
      designation: employees.designation, photoUrl: employees.photoUrl,
    }).from(employees),
    db.select().from(leaveTypes).orderBy(asc(leaveTypes.name)),
  ]);

  return (
    <div className="fade-up">
      <LeaveRequestsClient initial={requests} employees={emps} leaveTypes={types} />
    </div>
  );
}
