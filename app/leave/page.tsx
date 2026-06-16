import Link from "next/link";
import { db } from "@/lib/db";
import { employees, leaveTypes, leaveRequests } from "@/lib/schema";
import { asc, desc } from "drizzle-orm";
import LeaveRequestsClient from "./LeaveRequestsClient";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const requests = await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  const emps = await db.select({
    id: employees.id, employeeId: employees.employeeId,
    firstName: employees.firstName, lastName: employees.lastName,
    designation: employees.designation, photoUrl: employees.photoUrl,
  }).from(employees);
  const types = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.name));

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Requests</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Review pending requests, approve or reject.</p>
        </div>
        <Link href="/leave/apply" className="btn btn-primary">✍ Apply Leave</Link>
      </div>
      <LeaveRequestsClient initial={requests} employees={emps} leaveTypes={types} />
    </div>
  );
}
