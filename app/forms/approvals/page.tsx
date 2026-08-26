// Pending approvals — re-uses LeaveRequestsClient.
import Link from "next/link";
import { db } from "@/lib/db";
import { employees, leaveTypes, leaveRequests } from "@/lib/schema";
import { asc, desc } from "drizzle-orm";
import LeaveRequestsClient from "@/app/leave/LeaveRequestsClient";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  if (await isViewOnly("forms")) return <ViewOnlyNotice title="Approvals are edit-only" />;
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
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Pending Approvals</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Review pending leave + half-day requests. Approve or reject.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/forms/leave" className="btn">＋ New Leave</Link>
          <Link href="/forms/half-day" className="btn btn-primary">＋ New Half-Day</Link>
        </div>
      </div>
      <LeaveRequestsClient initial={requests} employees={emps} leaveTypes={types} />
    </div>
  );
}
