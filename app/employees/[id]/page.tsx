import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords } from "@/lib/schema";
import { eq } from "drizzle-orm";
import EmployeeProfileTabs from "@/components/EmployeeProfileTabs";
import DeleteEmployeeButton from "@/components/DeleteEmployeeButton";
import ProfileExportButton from "@/components/ProfileExportButton";

export const dynamic = "force-dynamic";

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = parseInt(id);
  if (isNaN(empId)) notFound();

  const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
  if (!emp) notFound();

  const edu = await db.select().from(educationRecords).where(eq(educationRecords.employeeId, empId));
  const exp = await db.select().from(experienceRecords).where(eq(experienceRecords.employeeId, empId));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/employees" style={{ fontSize: 12, color: "var(--primary)" }}>← Back to Employees</Link>
      </div>

      {/* Profile header */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
        {emp.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emp.photoUrl} alt="" className="avatar" style={{ width: 96, height: 96, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }} />
        ) : (
          <div className="avatar" style={{ width: 96, height: 96, background: "linear-gradient(135deg, var(--brand), var(--brand-dark))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
            {emp.firstName[0]}{emp.lastName[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", letterSpacing: 0.5 }}>{emp.employeeId}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginTop: 2 }}>
            {emp.firstName} {emp.lastName}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
            {emp.designation || "—"} {emp.department ? `• ${emp.department}` : ""}
          </div>
          <div style={{ marginTop: 6 }}>
            <span className={`badge ${emp.status === "active" ? "badge-active" : "badge-inactive"}`}>{emp.status}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/employees/${emp.id}/attendance`} className="btn">📋 Attendance</Link>
          <Link href={`/employees/${emp.id}/leave`} className="btn">📅 Leaves</Link>
          <ProfileExportButton employee={emp} />
          <Link href={`/employees/${emp.id}/print`} className="btn btn-print">🖨 Print Profile</Link>
          <Link href={`/employees/${emp.id}/edit`} className="btn">✏️ Edit</Link>
          <DeleteEmployeeButton id={emp.id} />
        </div>
      </div>

      <EmployeeProfileTabs employee={emp} education={edu} experience={exp} />
    </div>
  );
}
