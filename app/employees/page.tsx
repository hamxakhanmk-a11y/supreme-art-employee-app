import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { exitReasonsMap } from "@/lib/employeesServer";
import EmployeesList from "./EmployeesList";
import { employeeFieldAccess, maskEmployee } from "@/lib/employeeAccess";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  // The Excel export carries salary / bank columns only for a role with Employees · Salary / Banking.
  const access = await employeeFieldAccess();
  try {
    const [result, reasons] = await Promise.all([
      db.select().from(employees).orderBy(desc(employees.createdAt)),
      exitReasonsMap(),
    ]);
    // Full row (every column) so the directory's Excel export can include
    // everything, not just the fields the compact table itself displays.
    rows = result.map((r) => ({
      ...maskEmployee(r, access),
      exitReason: reasons.get(r.id) ?? null,
    }));
  } catch (e: any) {
    dbError = e?.message ?? "DB error";
  }

  return (
    <div className="fade-up">
      {dbError && (
        <div className="card no-print" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Database not ready:</strong> {dbError}
        </div>
      )}
      <EmployeesList rows={rows} hide={{ salary: !access.salary, banking: !access.banking }} />
    </div>
  );
}
