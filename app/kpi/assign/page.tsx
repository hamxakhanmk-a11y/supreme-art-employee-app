import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import AssignClient from "./AssignClient";

export const dynamic = "force-dynamic";

export default async function KpiAssignPage() {
  const emps = await db.select({
    id: employees.id,
    employeeId: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
    department: employees.department,
    designation: employees.designation,
    kpiTemplate: employees.kpiTemplate,
  }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName);

  return <AssignClient employees={emps} />;
}
