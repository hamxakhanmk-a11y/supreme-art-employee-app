import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { ensureOvertimeTable } from "@/lib/overtimeServer";
import OvertimeClient from "./OvertimeClient";

export const dynamic = "force-dynamic";

export default async function OvertimePage() {
  await ensureOvertimeTable();
  const emps = await db.select({
    id: employees.id,
    employeeId: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
    department: employees.department,
    status: employees.status,
    createdAt: employees.createdAt,
  }).from(employees).orderBy(employees.employeeId);

  return <OvertimeClient employees={emps} />;
}
