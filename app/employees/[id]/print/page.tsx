import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords } from "@/lib/schema";
import { eq } from "drizzle-orm";
import PrintableForm from "@/components/PrintableForm";

export const dynamic = "force-dynamic";

export default async function PrintEmployee({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = parseInt(id);
  if (isNaN(empId)) notFound();

  const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
  if (!emp) notFound();

  const edu = await db.select().from(educationRecords).where(eq(educationRecords.employeeId, empId));
  const exp = await db.select().from(experienceRecords).where(eq(experienceRecords.employeeId, empId));

  const data: any = {
    ...emp,
    education: edu,
    experience: exp,
  };

  return <PrintableForm data={data} />;
}
