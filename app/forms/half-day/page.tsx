import { db } from "@/lib/db";
import { employees, leaveTypes } from "@/lib/schema";
import { asc, eq, sql } from "drizzle-orm";
import ApplyHalfDayClient from "./ApplyHalfDayClient";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function HalfDayFormPage() {
  if (await isViewOnly("forms")) return <ViewOnlyNotice />;
  const [emps, halfTypeRow] = await Promise.all([
    db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
      designation: employees.designation, department: employees.department,
    }).from(employees).where(eq(employees.status, "active")).orderBy(asc(employees.firstName)),
    db.select({ id: leaveTypes.id }).from(leaveTypes).where(sql`lower(${leaveTypes.name}) = 'half day'`).limit(1),
  ]);
  const halfDayTypeId = halfTypeRow[0]?.id ?? null;

  return (
    <div className="fade-up">
      <div className="no-print" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Half-Day Leave Application</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Single-day, after 1 PM (per company policy). Print blank for manual filling or submit digitally.</p>
      </div>
      <ApplyHalfDayClient employees={emps} halfDayTypeId={halfDayTypeId} />
    </div>
  );
}
