import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { sql } from "drizzle-orm";

// `exit_reason` is self-provisioned (not in the Drizzle schema) so the many
// `select().from(employees)` star-selects across the app are unaffected — we
// only touch it through the helpers below.
let ensured = false;
export async function ensureEmployeeColumns() {
  if (ensured) return;
  await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS exit_reason text`);
  ensured = true;
}

// employeeId → exit reason, for employees that have one recorded.
export async function exitReasonsMap(): Promise<Map<number, string>> {
  await ensureEmployeeColumns();
  const rows = await db
    .select({ id: employees.id, reason: sql<string | null>`exit_reason` })
    .from(employees);
  const m = new Map<number, string>();
  for (const r of rows) if (r.reason && r.reason.trim()) m.set(r.id, r.reason);
  return m;
}

// The exit reason for one employee (or "").
export async function exitReasonFor(id: number): Promise<string> {
  await ensureEmployeeColumns();
  const [row] = await db
    .select({ reason: sql<string | null>`exit_reason` })
    .from(employees)
    .where(sql`id = ${id}`);
  return row?.reason?.trim() || "";
}

// Set (or clear with null) an employee's exit reason.
export async function setExitReason(id: number, reason: string | null) {
  await ensureEmployeeColumns();
  await db.execute(sql`UPDATE employees SET exit_reason = ${reason} WHERE id = ${id}`);
}
