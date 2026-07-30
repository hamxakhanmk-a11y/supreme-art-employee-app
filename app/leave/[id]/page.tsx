import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { leaveRequests, employees, leaveTypes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireAnyModule } from "@/lib/pageGuard";
import LeaveFormView from "./LeaveFormView";

export const dynamic = "force-dynamic";

export default async function LeaveFormPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyModule(["reports.leaves", "reports.halfday"]);
  const { id } = await params;
  const reqId = parseInt(id, 10);
  if (isNaN(reqId)) notFound();

  const [row] = await db
    .select({
      req: leaveRequests,
      emp: {
        id: employees.id,
        employeeId: employees.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        designation: employees.designation,
        department: employees.department,
      },
      lt: { id: leaveTypes.id, name: leaveTypes.name },
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(eq(leaveRequests.id, reqId));

  if (!row) notFound();

  return <LeaveFormView req={row.req} emp={row.emp} leaveType={row.lt} />;
}
