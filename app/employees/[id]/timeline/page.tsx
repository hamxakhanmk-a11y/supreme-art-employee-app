import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, activityLog } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import ActivityFeed from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function EmployeeTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = parseInt(id);

  const [emp] = await db.select({
    id: employees.id,
    employeeId: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
    designation: employees.designation,
    department: employees.department,
  }).from(employees).where(eq(employees.id, empId));
  if (!emp) notFound();

  const rows = await db.select().from(activityLog)
    .where(eq(activityLog.employeeId, empId))
    .orderBy(desc(activityLog.createdAt))
    .limit(200);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <Link href={`/employees/${emp.id}`} style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>← Back to Profile</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 0" }}>🕘 Timeline — {emp.firstName} {emp.lastName}</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {emp.employeeId} · {emp.designation || "—"} · every change made to this employee, newest first (last {rows.length}).
          </p>
        </div>
        <Link href="/reports/activity" className="btn">🗂 Full Activity Log</Link>
      </div>

      <div className="card">
        <ActivityFeed rows={rows} />
      </div>
    </div>
  );
}
