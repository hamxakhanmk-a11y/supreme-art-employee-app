import { db } from "@/lib/db";
import { salaryRecords, employees } from "@/lib/schema";
import { desc, asc } from "drizzle-orm";
import SalaryReportClient from "./SalaryReportClient";

export const dynamic = "force-dynamic";

export default async function SalaryReportPage() {
  const [records, emps] = await Promise.all([
    db.select().from(salaryRecords).orderBy(desc(salaryRecords.year), desc(salaryRecords.monthNum), asc(salaryRecords.employeeName)),
    db.select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: employees.department })
      .from(employees).orderBy(asc(employees.firstName)),
  ]);
  return <SalaryReportClient records={records as any[]} employees={emps as any[]} />;
}
