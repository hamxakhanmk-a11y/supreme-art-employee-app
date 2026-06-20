import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import EmployeeLeaveClient from "./EmployeeLeaveClient";

export const dynamic = "force-dynamic";

export default async function EmployeeLeavePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = parseInt(id);
  if (isNaN(empId)) notFound();

  const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
  if (!emp) notFound();
  const types = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.name));

  return (
    <div className="fade-up">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <Link href={`/employees/${empId}`} style={{ fontSize: 12, color: "var(--primary)" }}>← Back to Profile</Link>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        {emp.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emp.photoUrl} alt="" className="avatar" style={{ width: 72, height: 72 }} />
        ) : (
          <div className="avatar" style={{ width: 72, height: 72, background: "linear-gradient(135deg, var(--brand), var(--brand-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>
            {emp.firstName[0]}{emp.lastName[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>{emp.employeeId}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{emp.firstName} {emp.lastName}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{emp.designation || "—"} • Leave History</div>
        </div>
      </div>

      <EmployeeLeaveClient employee={{
        id: emp.id, employeeId: emp.employeeId,
        firstName: emp.firstName, lastName: emp.lastName,
      }} leaveTypes={types} />
    </div>
  );
}
