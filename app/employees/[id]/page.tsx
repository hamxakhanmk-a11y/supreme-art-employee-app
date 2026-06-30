import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import EmployeeProfileTabs from "@/components/EmployeeProfileTabs";
import DeleteEmployeeButton from "@/components/DeleteEmployeeButton";
import ProfileExportButton from "@/components/ProfileExportButton";

export const dynamic = "force-dynamic";

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = parseInt(id);
  if (isNaN(empId)) notFound();

  const [empArr, edu, exp, others] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, empId)),
    db.select().from(educationRecords).where(eq(educationRecords.employeeId, empId)),
    db.select().from(experienceRecords).where(eq(experienceRecords.employeeId, empId)),
    db.select().from(otherDocuments).where(eq(otherDocuments.employeeId, empId)),
  ]);
  const emp = empArr[0];
  if (!emp) notFound();

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
            <span style={{
              padding: "3px 12px", borderRadius: 999,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "capitalize",
              ...(emp.status === "active"
                ? { background: "#dcf5dc", color: "#15803D", border: "1px solid #a9e3a9" }
                : emp.status === "resigned"
                ? { background: "#fcdada", color: "#A32D2D", border: "1px solid #f3c2c2" }
                : { background: "#e2e8f0", color: "#475569", border: "1px solid #cbd5e1" }),
            }}>{emp.status}{emp.status === "resigned" && (emp as any).resignationDate ? ` · ${new Date((emp as any).resignationDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : ""}</span>
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

      <EmployeeProfileTabs employee={emp} education={edu} experience={exp} otherDocuments={others} />
    </div>
  );
}
