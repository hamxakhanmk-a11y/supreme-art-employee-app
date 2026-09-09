import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { inArray } from "drizzle-orm";
import EmployeePrintPage from "@/components/EmployeePrintPage";
import BulkPrintControls from "./BulkPrintControls";

export const dynamic = "force-dynamic";

// Bulk print: one full detail form per employee, back to back, each starting
// on its own page. Driven by ?ids=1,2,3 (built by EmployeesToolbar from
// whatever's currently filtered/searched on the directory) — no per-employee
// document picker here, since ticking attachments one by one doesn't scale
// across many people; each form just shows the plain, nothing-ticked
// documents checklist (same fallback the single-employee print already uses
// when nothing's attached).
export default async function PrintAllEmployees({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam || "").split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));

  if (ids.length === 0) {
    return (
      <div className="fade-up">
        <div className="card no-print" style={{ maxWidth: 600, margin: "40px auto", textAlign: "center" }}>
          No employees selected to print. <a href="/employees" style={{ color: "var(--primary)" }}>← Back to Employees</a>
        </div>
      </div>
    );
  }

  const [rows, edu, exp, others] = await Promise.all([
    db.select().from(employees).where(inArray(employees.id, ids)),
    db.select().from(educationRecords).where(inArray(educationRecords.employeeId, ids)),
    db.select().from(experienceRecords).where(inArray(experienceRecords.employeeId, ids)),
    db.select().from(otherDocuments).where(inArray(otherDocuments.employeeId, ids)),
  ]);

  // Keep the order the directory had them in (the ids list), not whatever
  // order the DB happens to return.
  const byId = new Map(rows.map(r => [r.id, r]));
  const ordered = ids.map(id => byId.get(id)).filter((r): r is typeof rows[number] => !!r);

  return (
    <div className="fade-up">
      <BulkPrintControls count={ordered.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ordered.map((emp, i) => (
          <div key={emp.id} style={i > 0 ? { pageBreakBefore: "always", breakBefore: "page" } : undefined}>
            <EmployeePrintPage
              data={{
                ...emp,
                education: edu.filter(e => e.employeeId === emp.id),
                experience: exp.filter(e => e.employeeId === emp.id),
                otherDocuments: others.filter(d => d.employeeId === emp.id).map(d => ({
                  id: d.id, label: d.label, url: d.url, category: d.category,
                })),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
