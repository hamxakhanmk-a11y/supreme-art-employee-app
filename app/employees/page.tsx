import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { exitReasonsMap } from "@/lib/employeesServer";
import EmployeesList from "./EmployeesList";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    const [result, reasons] = await Promise.all([
      db.select().from(employees).orderBy(desc(employees.createdAt)),
      exitReasonsMap(),
    ]);
    // Full row (every column) so the directory's Excel export can include
    // everything, not just the fields the compact table itself displays.
    rows = result.map((r) => ({
      ...r,
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
      <EmployeesList rows={rows} />
    </div>
  );
}
