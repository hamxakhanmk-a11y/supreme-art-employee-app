import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import PrintableForm from "@/components/PrintableForm";

export const dynamic = "force-dynamic";

export default async function PrintEmployee({ params }: { params: Promise<{ id: string }> }) {
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

  const data: any = {
    ...emp,
    education: edu,
    experience: exp,
    otherDocuments: others.map(d => ({
      id: d.id, label: d.label, url: d.url, category: d.category,
    })),
  };

  return <PrintableForm data={data} />;
}
