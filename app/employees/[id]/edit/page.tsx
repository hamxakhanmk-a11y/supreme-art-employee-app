import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import EmployeeForm from "@/components/EmployeeForm";

export const dynamic = "force-dynamic";

export default async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
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

  const initial: any = {
    ...emp,
    dob: emp.dob || "",
    cnicExpiry: emp.cnicExpiry || "",
    passportExpiry: emp.passportExpiry || "",
    joiningDate: emp.joiningDate || "",
    basicSalary: emp.basicSalary?.toString() || "",
    education: edu.map(e => ({
      degree: e.degree || "",
      institution: e.institution || "",
      yearCompleted: e.yearCompleted || "",
      grade: e.grade || "",
      certificateUrl: e.certificateUrl || "",
    })),
    experience: exp.map(e => ({
      company: e.company || "",
      position: e.position || "",
      fromDate: e.fromDate || "",
      toDate: e.toDate || "",
      description: e.description || "",
    })),
    otherDocuments: others.map(d => ({ label: d.label, url: d.url })),
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/employees/${empId}`} style={{ fontSize: 12, color: "var(--primary)" }}>← Back to Profile</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 4px" }}>Edit Employee</h1>
        <p style={{ color: "#888", fontSize: 13 }}>{emp.employeeId} • {emp.firstName} {emp.lastName}</p>
      </div>
      <EmployeeForm mode="edit" employeeId={empId} initial={initial} />
    </div>
  );
}
