import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import EntryClient from "./EntryClient";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function KpiEntryPage() {
  if (await isViewOnly()) return <ViewOnlyNotice />;
  const emps = await db.select({
    id: employees.id,
    employeeId: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
    department: employees.department,
    designation: employees.designation,
    kpiTemplate: employees.kpiTemplate,
  }).from(employees)
    .where(and(eq(employees.status, "active"), isNotNull(employees.kpiTemplate)))
    .orderBy(employees.firstName);

  if (emps.length === 0) {
    return (
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI &mdash; Monthly Entry</h1>
        <div className="card" style={{ marginTop: 16, borderLeft: "4px solid var(--brand)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>No employees have a KPI template yet</div>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 12px" }}>
            Assign a template to at least one employee first, then come back to enter their monthly figures.
          </p>
          <Link href="/kpi/assign" className="btn btn-primary">🔗 Assign Templates</Link>
        </div>
      </div>
    );
  }

  return <EntryClient employees={emps} />;
}
